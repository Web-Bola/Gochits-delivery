-- Customer-side features for launch: per-item notes, favorites, promo codes, ratings, opening hours,
-- push tokens and in-app account deletion. Money stays integer tetri; the server computes every total.

-- ---------------------------------------------------------------------------------------------
-- 1. Per-item note (removed ingredients, comment) and promo on the order
-- ---------------------------------------------------------------------------------------------
alter table order_items add column if not exists note text check (note is null or char_length(note) <= 300);
alter table orders add column if not exists promo_code text;

-- ---------------------------------------------------------------------------------------------
-- 2. Favorites
-- ---------------------------------------------------------------------------------------------
create table if not exists favorites (
  user_id uuid not null references profiles (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table favorites enable row level security;
create policy favorites_owner on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- 3. Promo codes. Not readable by clients (no code enumeration): validated only through functions.
--    The owner has not approved any real promotion. Only the demo code exists, and it works only in demo mode.
-- ---------------------------------------------------------------------------------------------
create table if not exists promo_codes (
  code text primary key check (code = upper(code) and char_length(code) between 3 and 30),
  percent_off integer check (percent_off between 1 and 100),
  amount_off_tetri integer check (amount_off_tetri > 0),
  min_subtotal_tetri integer not null default 0 check (min_subtotal_tetri >= 0),
  max_uses integer check (max_uses > 0),
  used_count integer not null default 0,
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  demo_only boolean not null default false,
  created_at timestamptz not null default now(),
  check ((percent_off is null) <> (amount_off_tetri is null))
);
alter table promo_codes enable row level security;
create policy promo_codes_admin on promo_codes for all using (is_super_admin()) with check (is_super_admin());
revoke all on promo_codes from anon, authenticated;

insert into promo_codes (code, percent_off, demo_only) values ('DEMO', 10, true) on conflict (code) do nothing;

-- Internal: returns the discount in tetri or raises. p_consume = true counts the use (inside create_order).
create or replace function promo_discount(p_code text, p_subtotal integer, p_consume boolean default false)
returns integer language plpgsql security definer set search_path = public as
$$
declare
  v promo_codes;
  d integer;
begin
  select * into v from promo_codes where code = upper(btrim(p_code)) for update;
  if not found or not v.is_active then raise exception 'promo_invalid'; end if;
  if v.demo_only and not is_demo_mode() then raise exception 'promo_invalid'; end if;
  if (v.valid_from is not null and now() < v.valid_from) or (v.valid_until is not null and now() > v.valid_until) then
    raise exception 'promo_expired';
  end if;
  if v.max_uses is not null and v.used_count >= v.max_uses then raise exception 'promo_used_up'; end if;
  if p_subtotal < v.min_subtotal_tetri then raise exception 'promo_min'; end if;
  d := case when v.percent_off is not null then (p_subtotal * v.percent_off) / 100 else least(v.amount_off_tetri, p_subtotal) end;
  if p_consume then update promo_codes set used_count = used_count + 1 where code = v.code; end if;
  return least(d, p_subtotal);
end
$$;

-- What the cart screen calls to preview a code. Never consumes it.
create or replace function apply_promo(p_code text, p_subtotal integer) returns integer
language plpgsql security definer set search_path = public as
$$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_subtotal is null or p_subtotal < 0 then raise exception 'promo_invalid'; end if;
  return promo_discount(p_code, p_subtotal, false);
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Ratings (only for the customer's own delivered order)
-- ---------------------------------------------------------------------------------------------
create table if not exists order_ratings (
  order_id uuid primary key references orders (id) on delete cascade,
  user_id uuid references profiles (id) on delete set null,
  stars smallint not null check (stars between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
alter table order_ratings enable row level security;
create policy ratings_read on order_ratings for select using (
  user_id = auth.uid() or is_super_admin()
  or exists (select 1 from orders o where o.id = order_id and is_branch_staff(o.branch_id)));
revoke insert, update, delete on order_ratings from anon, authenticated;

create or replace function rate_order(p_order_id uuid, p_stars integer, p_comment text default null) returns void
language plpgsql security definer set search_path = public as
$$
declare v_status order_status;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'bad_rating'; end if;
  select status into v_status from orders where id = p_order_id and customer_id = auth.uid();
  if not found then raise exception 'order_not_found'; end if;
  if v_status <> 'delivered' then raise exception 'invalid_state'; end if;
  insert into order_ratings (order_id, user_id, stars, comment)
  values (p_order_id, auth.uid(), p_stars, nullif(left(btrim(coalesce(p_comment, '')), 500), ''))
  on conflict (order_id) do update set stars = excluded.stars, comment = excluded.comment;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Opening hours. weekday follows extract(dow): 0 = Sunday ... 6 = Saturday, in the branch timezone.
--    A branch with NO hours rows is treated as open (accepts_orders is then the only switch).
--    closes < opens means the shift runs past midnight.
-- ---------------------------------------------------------------------------------------------
create or replace function branch_is_open(p_branch uuid, p_at timestamptz default now()) returns boolean
language plpgsql stable security definer set search_path = public as
$$
declare
  v_tz text;
  v_local timestamp;
  v_dow integer;
  v_t time;
  h branch_hours;
begin
  select timezone into v_tz from branches where id = p_branch;
  if not found then return false; end if;
  if not exists (select 1 from branch_hours where branch_id = p_branch) then return true; end if;
  v_local := p_at at time zone v_tz;
  v_dow := extract(dow from v_local)::integer;
  v_t := v_local::time;
  select * into h from branch_hours where branch_id = p_branch and weekday = v_dow;
  if found then
    if h.opens <= h.closes then
      if v_t >= h.opens and v_t < h.closes then return true; end if;
    else
      if v_t >= h.opens then return true; end if;
    end if;
  end if;
  -- yesterday's shift that ran past midnight
  select * into h from branch_hours where branch_id = p_branch and weekday = (v_dow + 6) % 7;
  if found and h.closes < h.opens and v_t < h.closes then return true; end if;
  return false;
end
$$;
grant execute on function branch_is_open to anon, authenticated;

drop function if exists resolve_branches(double precision, double precision);
create function resolve_branches(p_lat double precision, p_lng double precision)
returns table (
  branch_id uuid, branch_name text, zone_id uuid, zone_name text,
  fee_tetri integer, min_order_tetri integer, free_from_tetri integer,
  extra_minutes integer, distance_m double precision, can_order boolean, cod_enabled boolean, is_open boolean
)
language sql stable security definer set search_path = public as
$$
  with pt as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g)
  select distinct on (b.id)
         b.id, b.name, z.id, z.name, z.fee_tetri, z.min_order_tetri, z.free_from_tetri,
         z.extra_minutes,
         case when b.location is null then null else st_distance(b.location, pt.g) end,
         (b.is_active and b.accepts_orders and z.fee_tetri is not null and branch_is_open(b.id)),
         b.cod_enabled,
         branch_is_open(b.id)
  from pt
  join delivery_zones z on z.is_active and st_covers(z.area, pt.g)
  join branches b on b.id = z.branch_id and b.is_active
  order by b.id, z.fee_tetri nulls last
$$;
revoke all on function resolve_branches from public;
grant execute on function resolve_branches to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6. create_order v2: item notes, promo, per-element quantity check, opening hours
-- ---------------------------------------------------------------------------------------------
drop function if exists create_order(uuid, uuid, jsonb, payment_method, text);
create function create_order(
  p_branch_id uuid, p_address_id uuid, p_items jsonb,
  p_payment_method payment_method, p_notes text default null, p_promo text default null
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare
  v_user uuid := auth.uid();
  v_branch branches;
  v_addr addresses;
  v_zone delivery_zones;
  v_subtotal integer := 0;
  v_discount integer := 0;
  v_lines jsonb;
  v_fee integer;
  v_order uuid;
  v_number text;
  v_status order_status;
  v_promo text := nullif(upper(btrim(coalesce(p_promo, ''))), '');
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;
  -- every element must carry a sane integer quantity (a negative element must never offset another)
  if exists (select 1 from jsonb_array_elements(p_items) e
              where jsonb_typeof(e -> 'quantity') <> 'number' or (e ->> 'quantity') !~ '^[0-9]{1,2}$'
                 or (e ->> 'quantity')::integer < 1 or (e ->> 'quantity')::integer > 50) then
    raise exception 'bad_quantity';
  end if;

  select * into v_branch from branches where id = p_branch_id and is_active and accepts_orders for update;
  if not found then raise exception 'branch_unavailable'; end if;
  if not branch_is_open(p_branch_id) then raise exception 'branch_closed'; end if;

  select * into v_addr from addresses where id = p_address_id and user_id = v_user;
  if not found then raise exception 'address_not_found'; end if;

  select z.* into v_zone from delivery_zones z
   where z.branch_id = p_branch_id and z.is_active and st_covers(z.area, v_addr.location)
   order by z.fee_tetri nulls last limit 1;
  if not found then raise exception 'outside_zone'; end if;
  if v_zone.fee_tetri is null then raise exception 'fee_not_configured'; end if;

  if p_payment_method = 'cash' and not v_branch.cod_enabled then raise exception 'cash_not_allowed'; end if;

  -- price every line from the DB; the same product with a different note stays a separate line
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
  if exists (select 1 from jsonb_array_elements(v_lines) l where (l ->> 'qty')::integer > 50) then
    raise exception 'bad_quantity';
  end if;

  select sum((l ->> 'price')::integer * (l ->> 'qty')::integer) into v_subtotal from jsonb_array_elements(v_lines) l;
  if v_subtotal < v_zone.min_order_tetri then raise exception 'below_minimum'; end if;

  if v_promo is not null then
    v_discount := promo_discount(v_promo, v_subtotal, true);
  end if;

  v_fee := case when v_zone.free_from_tetri is not null and v_subtotal >= v_zone.free_from_tetri
                then 0 else v_zone.fee_tetri end;

  update branches set order_counter = order_counter + 1 where id = p_branch_id
    returning code || '-' || lpad(order_counter::text, 6, '0') into v_number;

  v_status := case when p_payment_method = 'cash' then 'placed' else 'pending_payment' end;

  insert into orders (number, customer_id, branch_id, zone_id, status, payment_method, payment_status,
                      address_snapshot, delivery_point, notes, subtotal_tetri, delivery_fee_tetri, discount_tetri, total_tetri, promo_code)
  values (v_number, v_user, p_branch_id, v_zone.id, v_status, p_payment_method,
          case when p_payment_method = 'cash' then 'unpaid' else 'pending' end::payment_status,
          to_jsonb(v_addr) - 'user_id' - 'location', v_addr.location, left(p_notes, 500),
          v_subtotal, v_fee, v_discount, v_subtotal - v_discount + v_fee, v_promo)
  returning id into v_order;

  insert into order_items (order_id, product_id, name_snapshot, unit_price_tetri, quantity, note)
  select v_order, (l ->> 'product_id')::uuid, l ->> 'name', (l ->> 'price')::integer, (l ->> 'qty')::integer, l ->> 'note'
    from jsonb_array_elements(v_lines) l;

  insert into order_events (order_id, from_status, to_status, actor_id) values (v_order, null, v_status, v_user);
  return v_order;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. Push tokens (the sender is a separate Edge Function, deployed later)
-- ---------------------------------------------------------------------------------------------
create table if not exists push_tokens (
  token text primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);
alter table push_tokens enable row level security;
create policy push_tokens_owner on push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- 8. In-app account deletion (required by Apple/Google). Personal data is removed; finished orders stay
--    for accounting but lose the link to the person and the delivery address.
--    What must be kept, and for how long, is a question for the lawyer.
-- ---------------------------------------------------------------------------------------------
alter table orders alter column customer_id drop not null;
alter table orders drop constraint if exists orders_customer_id_fkey;
alter table orders add constraint orders_customer_id_fkey foreign key (customer_id) references profiles (id) on delete set null;

create or replace function delete_my_account() returns void
language plpgsql security definer set search_path = public as
$$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from orders where customer_id = v_user
              and status in ('pending_payment', 'placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery')) then
    raise exception 'active_order';
  end if;
  update orders set address_snapshot = jsonb_build_object('deleted', true), notes = null where customer_id = v_user;
  delete from auth.users where id = v_user;   -- cascades: profile, addresses, favorites, push tokens
end
$$;

-- ---------------------------------------------------------------------------------------------
-- 9. Address helpers (lat/lng in and out as plain numbers) and a branch list with the open/closed state
-- ---------------------------------------------------------------------------------------------
create or replace function my_addresses()
returns table (id uuid, label text, street text, entrance text, floor text, apartment text, comment text, lat double precision, lng double precision)
language sql stable security invoker set search_path = public as
$$
  select a.id, a.label, a.street, a.entrance, a.floor, a.apartment, a.comment, st_y(a.location::geometry), st_x(a.location::geometry)
    from addresses a where a.user_id = auth.uid() order by a.created_at desc
$$;

create or replace function add_address(
  p_street text, p_entrance text, p_floor text, p_apartment text, p_comment text,
  p_lat double precision, p_lng double precision
) returns uuid
language plpgsql security definer set search_path = public as
$$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_street is null or char_length(btrim(p_street)) < 3 or char_length(p_street) > 200 then raise exception 'bad_address'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'bad_address'; end if;
  if (select count(*) from addresses where user_id = auth.uid()) >= 10 then raise exception 'too_many_addresses'; end if;
  insert into addresses (user_id, street, entrance, floor, apartment, comment, location)
  values (auth.uid(), btrim(p_street), nullif(left(btrim(coalesce(p_entrance, '')), 20), ''), nullif(left(btrim(coalesce(p_floor, '')), 20), ''),
          nullif(left(btrim(coalesce(p_apartment, '')), 20), ''), nullif(left(btrim(coalesce(p_comment, '')), 300), ''),
          st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography)
  returning id into v_id;
  return v_id;
end
$$;

create or replace function list_branches()
returns table (id uuid, name text, address text, phone text, accepts_orders boolean, is_open boolean)
language sql stable security definer set search_path = public as
$$
  select b.id, b.name, b.address, b.phone, b.accepts_orders, branch_is_open(b.id)
    from branches b where b.is_active order by b.code
$$;

-- ---------------------------------------------------------------------------------------------
-- 10. Customer cancels their own order. Only while the restaurant has not accepted it and no card money
--     has been captured (refunds depend on the payment provider, which is not chosen yet).
-- ---------------------------------------------------------------------------------------------
create or replace function cancel_my_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare v_order orders;
begin
  select * into v_order from orders where id = p_order_id and customer_id = auth.uid() for update;
  if not found then raise exception 'order_not_found'; end if;
  if not (v_order.status = 'pending_payment'
          or (v_order.status = 'placed' and v_order.payment_status <> 'paid')) then
    raise exception 'cannot_cancel';
  end if;
  update orders set status = 'cancelled', updated_at = now() where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, v_order.status, 'cancelled', auth.uid());
end
$$;

revoke all on function promo_discount, apply_promo, rate_order, delete_my_account, create_order, my_addresses, add_address, list_branches, cancel_my_order from public;
grant execute on function apply_promo, rate_order, delete_my_account, create_order, my_addresses, add_address, cancel_my_order to authenticated;
grant execute on function list_branches to anon, authenticated;
