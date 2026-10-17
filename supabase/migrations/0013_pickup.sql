-- Self pick-up ("თვითონ წამოვიღებ"): the customer orders in the app and collects the order at the branch. No courier, no address, no delivery fee.
-- Same orders table, same restaurant panel. Delivery orders are not affected.

alter table orders add column if not exists fulfillment text not null default 'delivery' check (fulfillment in ('delivery', 'pickup'));
alter table orders add column if not exists pickup_minutes integer check (pickup_minutes between 0 and 240);
alter table orders alter column zone_id drop not null;
alter table orders alter column address_snapshot drop not null;
alter table orders alter column delivery_point drop not null;
alter table orders drop constraint if exists orders_fulfillment_ck;
alter table orders add constraint orders_fulfillment_ck check (
  fulfillment = 'pickup' or (zone_id is not null and address_snapshot is not null and delivery_point is not null));

alter table branches add column if not exists pickup_enabled boolean not null default true;
alter table branches add column if not exists pickup_discount_percent integer not null default 0 check (pickup_discount_percent between 0 and 50);

-- 1. Create a pick-up order (prices always come from the database).
create or replace function create_pickup_order(
  p_branch_id uuid, p_items jsonb, p_payment_method payment_method,
  p_notes text default null, p_promo text default null, p_pickup_minutes integer default 0
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare
  v_user uuid := auth.uid();
  v_branch branches;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_pdisc integer := 0;
  v_lines jsonb;
  v_order uuid;
  v_number text;
  v_status order_status;
  v_promo text := nullif(upper(btrim(coalesce(p_promo, ''))), '');
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_cart'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
              where jsonb_typeof(e -> 'quantity') <> 'number' or (e ->> 'quantity') !~ '^[0-9]{1,2}$'
                 or (e ->> 'quantity')::integer < 1 or (e ->> 'quantity')::integer > 50) then
    raise exception 'bad_quantity';
  end if;

  select * into v_branch from branches where id = p_branch_id and is_active and accepts_orders for update;
  if not found then raise exception 'branch_unavailable'; end if;
  if not v_branch.pickup_enabled then raise exception 'pickup_disabled'; end if;
  if not branch_is_open(p_branch_id) then raise exception 'branch_closed'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('product_id', x.id, 'name', x.name, 'price', x.price, 'qty', x.qty, 'note', x.note)), '[]'::jsonb)
    into v_lines
    from (
      select p.id, p.name, coalesce(bp.price_override_tetri, p.price_tetri) as price,
             nullif(left(btrim(coalesce(e ->> 'note', '')), 300), '') as note,
             sum((e ->> 'quantity')::integer) as qty
        from jsonb_array_elements(p_items) e
        join products p on p.id = (e ->> 'product_id')::uuid and p.is_active
        join branch_products bp on bp.product_id = p.id and bp.branch_id = p_branch_id and bp.is_available
       group by p.id, p.name, 3, 4
    ) x;

  if (select count(distinct e ->> 'product_id') from jsonb_array_elements(p_items) e)
     <> (select count(distinct l ->> 'product_id') from jsonb_array_elements(v_lines) l) then
    raise exception 'product_unavailable';
  end if;
  if exists (select 1 from jsonb_array_elements(v_lines) l where (l ->> 'qty')::integer > 50) then raise exception 'bad_quantity'; end if;

  select sum((l ->> 'price')::integer * (l ->> 'qty')::integer) into v_subtotal from jsonb_array_elements(v_lines) l;

  if v_promo is not null then v_discount := promo_discount(v_promo, v_subtotal, true); end if;
  v_pdisc := (v_subtotal * v_branch.pickup_discount_percent) / 100;
  v_discount := least(v_subtotal, v_discount + v_pdisc);

  update branches set order_counter = order_counter + 1 where id = p_branch_id
    returning code || '-' || lpad(order_counter::text, 6, '0') into v_number;

  v_status := case when p_payment_method = 'cash' then 'placed' else 'pending_payment' end;

  insert into orders (number, customer_id, branch_id, zone_id, status, payment_method, payment_status,
                      address_snapshot, delivery_point, notes, subtotal_tetri, delivery_fee_tetri, discount_tetri, total_tetri, promo_code,
                      fulfillment, pickup_minutes)
  values (v_number, v_user, p_branch_id, null, v_status, p_payment_method,
          case when p_payment_method = 'cash' then 'unpaid' else 'pending' end::payment_status,
          null, null, left(p_notes, 500), v_subtotal, 0, v_discount, v_subtotal - v_discount, v_promo,
          'pickup', greatest(0, least(240, coalesce(p_pickup_minutes, 0))))
  returning id into v_order;

  insert into order_items (order_id, product_id, name_snapshot, unit_price_tetri, quantity, note)
  select v_order, (l ->> 'product_id')::uuid, l ->> 'name', (l ->> 'price')::integer, (l ->> 'qty')::integer, l ->> 'note'
    from jsonb_array_elements(v_lines) l;

  insert into order_events (order_id, from_status, to_status, actor_id) values (v_order, null, v_status, v_user);
  return v_order;
end
$$;

-- 2. Restaurant staff: pick-up orders can also be handed over ("გაიცა").
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
    ('accepted', 'preparing'), ('accepted', 'ready_for_pickup'), ('accepted', 'cancelled'),
    ('preparing', 'ready_for_pickup'), ('preparing', 'cancelled')
  ) or (v_order.fulfillment = 'pickup' and v_order.status = 'ready_for_pickup' and p_to = 'delivered');
  if not v_ok then raise exception 'invalid_transition % -> %', v_order.status, p_to; end if;

  update orders set status = p_to, updated_at = now() where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, v_order.status, p_to, auth.uid());
end
$$;

-- 3. Couriers never see pick-up orders.
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
    where o.fulfillment = 'delivery' and (
          (o.courier_id = auth.uid() and (o.status in ('accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery')
                                          or (o.status in ('cancelled', 'rejected') and o.updated_at > now() - interval '30 minutes')))
       or (o.courier_id is null and o.status in ('accepted', 'preparing', 'ready_for_pickup')
           and not exists (select 1 from courier_declines d where d.order_id = o.id and d.courier_id = auth.uid())))
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
  if v_order.fulfillment <> 'delivery' or v_order.status not in ('accepted', 'preparing', 'ready_for_pickup') then raise exception 'not_available'; end if;
  if v_order.courier_id is not null and v_order.courier_id <> auth.uid() then raise exception 'already_taken'; end if;
  insert into couriers (user_id, status) values (auth.uid(), 'approved') on conflict (user_id) do nothing;
  update orders set courier_id = auth.uid(), updated_at = now() where id = p_order_id;
end
$$;

-- 4. Demo mode: the tracking demo follows the pick-up path for pick-up orders.
create or replace function demo_advance_order(p_order_id uuid) returns order_status
language plpgsql security definer set search_path = public as
$$
declare
  v_order orders;
  v_next order_status;
begin
  if not is_demo_mode() then raise exception 'demo_disabled'; end if;
  select * into v_order from orders where id = p_order_id and customer_id = auth.uid() for update;
  if not found then raise exception 'order_not_found'; end if;
  v_next := case v_order.status
    when 'placed' then 'accepted' when 'accepted' then 'preparing' when 'preparing' then 'ready_for_pickup'
    when 'ready_for_pickup' then (case when v_order.fulfillment = 'pickup' then 'delivered' else 'out_for_delivery' end)
    when 'out_for_delivery' then 'delivered' else null end;
  if v_next is null then raise exception 'invalid_state'; end if;
  update orders set status = v_next, updated_at = now() where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, v_order.status, v_next, auth.uid());
  return v_next;
end
$$;

-- 5. Branch list for the app now says whether pick-up is available and where the branch is.
drop function if exists list_branches();
create function list_branches()
returns table (id uuid, name text, address text, phone text, accepts_orders boolean, is_open boolean,
               pickup_enabled boolean, pickup_discount_percent integer, lat double precision, lng double precision)
language sql stable security definer set search_path = public as
$$
  select b.id, b.name, b.address, b.phone, b.accepts_orders, branch_is_open(b.id),
         b.pickup_enabled, b.pickup_discount_percent, st_y(b.location::geometry), st_x(b.location::geometry)
    from branches b where b.is_active order by b.code
$$;

-- 6. Admin: pick-up settings per branch (the same switches the restaurant sees).
drop function if exists admin_branches();
create function admin_branches() returns table (
  id uuid, code text, name text, address text, phone text, lat double precision, lng double precision,
  is_active boolean, accepts_orders boolean, cod_enabled boolean, pickup_enabled boolean, pickup_discount_percent integer
) language plpgsql security definer set search_path = public as
$$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query select b.id, b.code, b.name, b.address, b.phone, st_y(b.location::geometry), st_x(b.location::geometry),
    b.is_active, b.accepts_orders, b.cod_enabled, b.pickup_enabled, b.pickup_discount_percent from branches b order by b.code;
end
$$;

drop function if exists admin_save_branch(uuid, text, text, text, text, double precision, double precision, boolean, boolean, boolean);
create function admin_save_branch(
  p_id uuid, p_code text, p_name text, p_address text, p_phone text, p_lat double precision, p_lng double precision,
  p_is_active boolean, p_accepts_orders boolean, p_cod_enabled boolean,
  p_pickup_enabled boolean default true, p_pickup_discount_percent integer default 0
) returns uuid language plpgsql security definer set search_path = public as
$$
declare v_loc geography; v_id uuid;
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  if coalesce(p_pickup_discount_percent, 0) not between 0 and 50 then raise exception 'bad_discount'; end if;
  v_loc := case when p_lat is null or p_lng is null then null else st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end;
  if p_id is null then
    insert into branches (code, name, address, phone, location, is_active, accepts_orders, cod_enabled, pickup_enabled, pickup_discount_percent)
    values (upper(btrim(p_code)), p_name, nullif(btrim(p_address), ''), nullif(btrim(p_phone), ''), v_loc, coalesce(p_is_active, true), coalesce(p_accepts_orders, false), coalesce(p_cod_enabled, false),
            coalesce(p_pickup_enabled, true), coalesce(p_pickup_discount_percent, 0))
    returning id into v_id;
  else
    update branches set name = p_name, address = nullif(btrim(p_address), ''), phone = nullif(btrim(p_phone), ''), location = v_loc,
      is_active = coalesce(p_is_active, true), accepts_orders = coalesce(p_accepts_orders, false), cod_enabled = coalesce(p_cod_enabled, false),
      pickup_enabled = coalesce(p_pickup_enabled, true), pickup_discount_percent = coalesce(p_pickup_discount_percent, 0)
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'branch_not_found'; end if;
  end if;
  return v_id;
end
$$;

-- 7. The restaurant can switch pick-up on/off for its own branch (next to "accepting orders").
create or replace function staff_set_pickup(p_branch uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if not is_branch_staff(p_branch) then raise exception 'forbidden'; end if;
  update branches set pickup_enabled = p_on where id = p_branch;
end
$$;

drop function if exists staff_my_branches();
create function staff_my_branches() returns table (id uuid, name text, accepts_orders boolean, pickup_enabled boolean)
language plpgsql security definer set search_path = public as
$$
begin
  return query
    select b.id, b.name, b.accepts_orders, b.pickup_enabled from branches b
    where b.is_active and (is_super_admin() or exists (select 1 from staff_branches sb where sb.user_id = auth.uid() and sb.branch_id = b.id and is_branch_staff(b.id)))
    order by b.code;
end
$$;

revoke all on function staff_my_branches from public, anon;
grant execute on function staff_my_branches to authenticated;

revoke all on function create_pickup_order, admin_branches, admin_save_branch, staff_set_pickup, list_branches from public, anon;
grant execute on function create_pickup_order, admin_branches, admin_save_branch, staff_set_pickup to authenticated;
grant execute on function list_branches to anon, authenticated;
