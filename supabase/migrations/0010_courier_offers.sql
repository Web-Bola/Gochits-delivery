-- Courier offers: a new order is visible to couriers as soon as it is placed; the first courier to accept it gets it.
-- Staff can hand an order over only after a courier has accepted it; only that courier can mark it delivered.

create table courier_declines (
  order_id uuid not null references orders (id) on delete cascade,
  courier_id uuid not null references profiles (id) on delete cascade,
  primary key (order_id, courier_id)
);
alter table courier_declines enable row level security;   -- no policies: only the functions below touch it

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
  if p_to = 'out_for_delivery' and v_order.courier_id is null then raise exception 'no_courier'; end if;

  update orders set status = p_to, updated_at = now() where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, v_order.status, p_to, auth.uid());
end
$$;

drop function if exists courier_deliveries();

-- Everything a courier sees: open offers (limited details) + their own orders (full details).
create or replace function courier_feed() returns table (
  id uuid, number text, status order_status, mine boolean, branch_name text, branch_address text,
  branch_lat double precision, branch_lng double precision, dest_lat double precision, dest_lng double precision,
  address_snapshot jsonb, phone text, full_name text, total_tetri integer, delivery_fee_tetri integer,
  payment_method payment_method, payment_status payment_status, distance_m integer, created_at timestamptz)
language plpgsql security definer set search_path = public as
$$
begin
  if not is_courier() then raise exception 'forbidden'; end if;
  return query
    select o.id, o.number::text, o.status, coalesce(o.courier_id = auth.uid(), false), b.name::text, b.address::text,
           st_y(b.location::geometry), st_x(b.location::geometry), st_y(o.delivery_point::geometry), st_x(o.delivery_point::geometry),
           case when o.courier_id = auth.uid() then o.address_snapshot else jsonb_build_object('street', o.address_snapshot->>'street') end,
           case when o.courier_id = auth.uid() then p.phone::text end,
           case when o.courier_id = auth.uid() then p.full_name::text end,
           o.total_tetri, o.delivery_fee_tetri, o.payment_method, o.payment_status,
           case when b.location is null then null else round(st_distance(b.location, o.delivery_point))::integer end,
           o.created_at
    from orders o join branches b on b.id = o.branch_id left join profiles p on p.id = o.customer_id
    where (o.courier_id = auth.uid() and (o.status in ('placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery')
                                          or (o.status in ('cancelled', 'rejected') and o.updated_at > now() - interval '30 minutes')))
       or (o.courier_id is null and o.status in ('placed', 'accepted', 'preparing', 'ready_for_pickup')
           and not exists (select 1 from courier_declines d where d.order_id = o.id and d.courier_id = auth.uid()))
    order by o.created_at;
end
$$;

create or replace function courier_accept(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare v_order orders;
begin
  if not is_courier() then raise exception 'forbidden'; end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status not in ('placed', 'accepted', 'preparing', 'ready_for_pickup') then raise exception 'not_available'; end if;
  if v_order.courier_id is not null and v_order.courier_id <> auth.uid() then raise exception 'already_taken'; end if;
  insert into couriers (user_id, status) values (auth.uid(), 'approved') on conflict (user_id) do nothing;
  update orders set courier_id = auth.uid(), updated_at = now() where id = p_order_id;
end
$$;

create or replace function courier_decline(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if not is_courier() then raise exception 'forbidden'; end if;
  insert into courier_declines (order_id, courier_id) values (p_order_id, auth.uid()) on conflict do nothing;
end
$$;

-- A courier who accepted can give the order back until it is on the way.
create or replace function courier_release(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare v_order orders;
begin
  if not is_courier() then raise exception 'forbidden'; end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found or v_order.courier_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if v_order.status not in ('placed', 'accepted', 'preparing', 'ready_for_pickup') then raise exception 'too_late'; end if;
  update orders set courier_id = null, updated_at = now() where id = p_order_id;
  insert into courier_declines (order_id, courier_id) values (p_order_id, auth.uid()) on conflict do nothing;
end
$$;

create or replace function courier_mark_delivered(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare v_order orders;
begin
  if not is_courier() then raise exception 'forbidden'; end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.courier_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if v_order.status <> 'out_for_delivery' then raise exception 'invalid_transition % -> delivered', v_order.status; end if;
  update orders set status = 'delivered', updated_at = now(),
    payment_status = case when payment_method = 'cash' then 'paid'::payment_status else payment_status end
  where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, v_order.status, 'delivered', auth.uid());
end
$$;

-- Restaurant staff: which courier accepted which order.
create or replace function staff_order_couriers(p_branch uuid) returns table (order_id uuid, courier_name text, courier_phone text)
language plpgsql security definer set search_path = public as
$$
begin
  if not is_branch_staff(p_branch) then raise exception 'forbidden'; end if;
  return query
    select o.id, coalesce(nullif(p.full_name, ''), u.email)::text, p.phone::text
    from orders o join profiles p on p.id = o.courier_id left join auth.users u on u.id = o.courier_id
    where o.branch_id = p_branch and o.courier_id is not null and o.created_at > now() - interval '2 days';
end
$$;

revoke all on function courier_feed, courier_accept, courier_decline, courier_release, courier_mark_delivered, staff_order_couriers from public;
grant execute on function courier_feed, courier_accept, courier_decline, courier_release, courier_mark_delivered, staff_order_couriers to authenticated;
