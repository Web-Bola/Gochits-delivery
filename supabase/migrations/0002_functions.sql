-- Role helpers (SECURITY DEFINER so RLS policies can use them without recursion)
create or replace function current_role_name() returns user_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function is_super_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'super_admin' from profiles where id = auth.uid()), false) $$;

create or replace function is_branch_staff(p_branch uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select is_super_admin() or exists (
     select 1 from staff_branches sb join profiles p on p.id = sb.user_id
     where sb.user_id = auth.uid() and sb.branch_id = p_branch and p.role = 'restaurant_staff') $$;

-- Which branches deliver to this point? The app never decides this itself.
-- Closed/inactive branches are returned with can_order=false so the UI can explain why.
create or replace function resolve_branches(p_lat double precision, p_lng double precision)
returns table (
  branch_id uuid, branch_name text, zone_id uuid, zone_name text,
  fee_tetri integer, min_order_tetri integer, free_from_tetri integer,
  extra_minutes integer, distance_m double precision, can_order boolean
)
language sql stable security definer set search_path = public as
$$
  with pt as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g)
  select distinct on (b.id)
         b.id, b.name, z.id, z.name, z.fee_tetri, z.min_order_tetri, z.free_from_tetri,
         z.extra_minutes,
         case when b.location is null then null else st_distance(b.location, pt.g) end,
         (b.is_active and b.accepts_orders and z.fee_tetri is not null)
  from pt
  join delivery_zones z on z.is_active and st_covers(z.area, pt.g)
  join branches b on b.id = z.branch_id and b.is_active
  order by b.id, z.fee_tetri nulls last
$$;

-- Server-side order creation. Prices, fee and totals come only from the database.
create or replace function create_order(
  p_branch_id uuid, p_address_id uuid, p_items jsonb,
  p_payment_method payment_method, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare
  v_user uuid := auth.uid();
  v_branch branches;
  v_addr addresses;
  v_zone delivery_zones;
  v_subtotal integer := 0;
  v_lines jsonb;
  v_fee integer;
  v_order uuid;
  v_number text;
  v_status order_status;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;

  select * into v_branch from branches where id = p_branch_id and is_active and accepts_orders for update;
  if not found then raise exception 'branch_unavailable'; end if;

  select * into v_addr from addresses where id = p_address_id and user_id = v_user;
  if not found then raise exception 'address_not_found'; end if;

  select z.* into v_zone from delivery_zones z
   where z.branch_id = p_branch_id and z.is_active and st_covers(z.area, v_addr.location)
   order by z.fee_tetri nulls last limit 1;
  if not found then raise exception 'outside_zone'; end if;
  if v_zone.fee_tetri is null then raise exception 'fee_not_configured'; end if;

  if p_payment_method = 'cash' and not v_branch.cod_enabled then raise exception 'cash_not_allowed'; end if;

  -- aggregate duplicate lines and price them from the DB (client prices are never read)
  select coalesce(jsonb_agg(jsonb_build_object('product_id', x.id, 'name', x.name, 'price', x.price, 'qty', x.qty)), '[]'::jsonb)
    into v_lines
    from (
      select p.id, p.name, coalesce(bp.price_override_tetri, p.price_tetri) as price, sum((e ->> 'quantity')::integer) as qty
        from jsonb_array_elements(p_items) e
        join products p on p.id = (e ->> 'product_id')::uuid and p.is_active
        join branch_products bp on bp.product_id = p.id and bp.branch_id = p_branch_id and bp.is_available
       group by p.id, p.name, 3
    ) x;

  if (select count(distinct (e ->> 'product_id')) from jsonb_array_elements(p_items) e) <> jsonb_array_length(v_lines) then
    raise exception 'product_unavailable';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lines) l where (l ->> 'qty')::integer < 1 or (l ->> 'qty')::integer > 50) then
    raise exception 'bad_quantity';
  end if;

  select sum((l ->> 'price')::integer * (l ->> 'qty')::integer) into v_subtotal from jsonb_array_elements(v_lines) l;
  if v_subtotal < v_zone.min_order_tetri then raise exception 'below_minimum'; end if;

  v_fee := case when v_zone.free_from_tetri is not null and v_subtotal >= v_zone.free_from_tetri
                then 0 else v_zone.fee_tetri end;

  update branches set order_counter = order_counter + 1 where id = p_branch_id
    returning code || '-' || lpad(order_counter::text, 6, '0') into v_number;

  v_status := case when p_payment_method = 'cash' then 'placed' else 'pending_payment' end;

  insert into orders (number, customer_id, branch_id, zone_id, status, payment_method, payment_status,
                      address_snapshot, delivery_point, notes, subtotal_tetri, delivery_fee_tetri, total_tetri)
  values (v_number, v_user, p_branch_id, v_zone.id, v_status, p_payment_method,
          case when p_payment_method = 'cash' then 'unpaid' else 'pending' end::payment_status,
          to_jsonb(v_addr) - 'user_id' - 'location', v_addr.location, p_notes,
          v_subtotal, v_fee, v_subtotal + v_fee)
  returning id into v_order;

  insert into order_items (order_id, product_id, name_snapshot, unit_price_tetri, quantity)
  select v_order, (l ->> 'product_id')::uuid, l ->> 'name', (l ->> 'price')::integer, (l ->> 'qty')::integer
    from jsonb_array_elements(v_lines) l;

  insert into order_events (order_id, from_status, to_status, actor_id) values (v_order, null, v_status, v_user);
  return v_order;
end
$$;

-- Allowed status moves for staff of the order's branch (customer cancel handled separately).
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
    ('ready_for_pickup', 'out_for_delivery'),
    ('out_for_delivery', 'delivered')
  );
  if not v_ok then raise exception 'invalid_transition % -> %', v_order.status, p_to; end if;

  update orders set status = p_to, updated_at = now() where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, v_order.status, p_to, auth.uid());
end
$$;

revoke all on function create_order, transition_order, resolve_branches from public;
grant execute on function resolve_branches to anon, authenticated;
grant execute on function create_order, transition_order to authenticated;
