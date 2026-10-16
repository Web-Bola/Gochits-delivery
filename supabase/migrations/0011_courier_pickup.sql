-- Orders reach couriers only after the restaurant accepts them; the courier (not the restaurant) confirms pick-up.

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
    ('preparing', 'ready_for_pickup'), ('preparing', 'cancelled')
  );
  if not v_ok then raise exception 'invalid_transition % -> %', v_order.status, p_to; end if;

  update orders set status = p_to, updated_at = now() where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, v_order.status, p_to, auth.uid());
end
$$;

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
    where (o.courier_id = auth.uid() and (o.status in ('accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery')
                                          or (o.status in ('cancelled', 'rejected') and o.updated_at > now() - interval '30 minutes')))
       or (o.courier_id is null and o.status in ('accepted', 'preparing', 'ready_for_pickup')
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
  if v_order.status not in ('accepted', 'preparing', 'ready_for_pickup') then raise exception 'not_available'; end if;
  if v_order.courier_id is not null and v_order.courier_id <> auth.uid() then raise exception 'already_taken'; end if;
  insert into couriers (user_id, status) values (auth.uid(), 'approved') on conflict (user_id) do nothing;
  update orders set courier_id = auth.uid(), updated_at = now() where id = p_order_id;
end
$$;

-- The courier confirms that he has taken the order from the restaurant.
create or replace function courier_pickup(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare v_order orders;
begin
  if not is_courier() then raise exception 'forbidden'; end if;
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.courier_id is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if v_order.status <> 'ready_for_pickup' then raise exception 'not_ready'; end if;
  update orders set status = 'out_for_delivery', updated_at = now() where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, 'ready_for_pickup', 'out_for_delivery', auth.uid());
end
$$;

revoke all on function courier_pickup from public;
grant execute on function courier_pickup to authenticated;
