-- Courier hand-over: the restaurant gives the order to a courier; only the courier marks it delivered.

-- 1. Staff can no longer mark "delivered" (the courier does it).
create or replace function transition_order(p_order_id uuid, p_to order_status) returns void
language plpgsql security definer set search_path = public as
$$
declare
  v_order orders;
  v_ok boolean;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if not is_branch_staff(v_order.branch_id) then raise exception 'forbidden'; end if;

  v_ok := (v_order.status, p_to) in (
    ('placed', 'accepted'), ('placed', 'rejected'),
    ('accepted', 'preparing'), ('accepted', 'cancelled'),
    ('preparing', 'ready_for_pickup'), ('preparing', 'cancelled'),
    ('ready_for_pickup', 'out_for_delivery')
  );
  if not v_ok then raise exception 'invalid_transition % -> %', v_order.status, p_to; end if;

  update orders set status = p_to, updated_at = now() where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, v_order.status, p_to, auth.uid());
end
$$;

create or replace function is_courier() returns boolean
language sql stable security definer set search_path = public as
$$ select is_super_admin() or exists (select 1 from profiles where id = auth.uid() and role = 'courier'); $$;

-- 2. Orders that have been handed to couriers and are still on the way.
create or replace function courier_deliveries() returns table (
  id uuid, number text, branch_name text, address_snapshot jsonb, phone text, full_name text,
  total_tetri integer, payment_method payment_method, payment_status payment_status, created_at timestamptz)
language plpgsql security definer set search_path = public as
$$
begin
  if not is_courier() then raise exception 'forbidden'; end if;
  return query
    select o.id, o.number::text, b.name, o.address_snapshot, p.phone::text, p.full_name::text,
           o.total_tetri, o.payment_method, o.payment_status, o.created_at
    from orders o join branches b on b.id = o.branch_id left join profiles p on p.id = o.customer_id
    where o.status = 'out_for_delivery'
    order by o.updated_at;
end
$$;

-- 3. Courier confirms delivery. Cash orders count as paid at that moment.
create or replace function courier_mark_delivered(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare v_order orders;
begin
  if not is_courier() then raise exception 'forbidden'; end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status <> 'out_for_delivery' then raise exception 'invalid_transition % -> delivered', v_order.status; end if;
  update orders set status = 'delivered', updated_at = now(),
    payment_status = case when payment_method = 'cash' then 'paid'::payment_status else payment_status end,
    courier_id = case when exists (select 1 from couriers where user_id = auth.uid()) then auth.uid() else courier_id end
  where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, v_order.status, 'delivered', auth.uid());
end
$$;

-- 4. Admin: make an existing user a courier.
create or replace function admin_add_courier(p_email text) returns void
language plpgsql security definer set search_path = public as
$$
declare v_user uuid; v_role user_role;
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then raise exception 'user_not_found'; end if;
  select role into v_role from profiles where id = v_user;
  if v_role in ('super_admin', 'restaurant_staff') then raise exception 'already_admin'; end if;
  update profiles set role = 'courier' where id = v_user;
  insert into couriers (user_id, status) values (v_user, 'approved') on conflict (user_id) do update set status = 'approved';
end
$$;

create or replace function admin_couriers() returns table (user_id uuid, email text, full_name text)
language plpgsql security definer set search_path = public as
$$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query select c.user_id, u.email::text, p.full_name::text from couriers c join auth.users u on u.id = c.user_id join profiles p on p.id = c.user_id order by u.email;
end
$$;

create or replace function admin_remove_courier(p_user uuid) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  delete from couriers where user_id = p_user;
  update profiles set role = 'customer' where id = p_user and role = 'courier';
end
$$;

revoke all on function is_courier, courier_deliveries, courier_mark_delivered, admin_add_courier, admin_couriers, admin_remove_courier from public;
grant execute on function is_courier, courier_deliveries, courier_mark_delivered, admin_add_courier, admin_couriers, admin_remove_courier to authenticated;
