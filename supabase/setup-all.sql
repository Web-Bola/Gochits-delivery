-- Gochit's: ALL-IN-ONE setup for a NEW empty Supabase project. Paste into SQL Editor and press Run ONCE.

-- ===== migrations/0001_schema.sql =====
-- Gochit's Delivery: core schema (ARCHITECTURE.md v0.2, 6 branches with own zones)
-- Money is always integer tetri (1 GEL = 100 tetri). Prices/fees below are data, never hardcoded.
create extension if not exists postgis;
create extension if not exists pgcrypto;

create type user_role as enum ('customer', 'courier', 'restaurant_staff', 'super_admin');
create type order_status as enum (
  'pending_payment', 'payment_failed', 'placed', 'accepted', 'preparing',
  'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'rejected'
);
create type payment_method as enum ('card', 'cash');
create type payment_status as enum ('unpaid', 'pending', 'paid', 'failed', 'refunded');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'customer',
  full_name text,
  phone text,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now()
);

-- 6 branches at launch. Names/addresses/phones are provided later by the owner.
create table branches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,            -- short code, also the order-number prefix
  name text not null,
  address text,
  phone text,
  location geography (point, 4326),
  is_active boolean not null default true,
  accepts_orders boolean not null default false, -- off until the owner enables it
  cod_enabled boolean not null default false,     -- D-COD: cash on delivery per branch
  order_counter integer not null default 0,
  timezone text not null default 'Asia/Tbilisi',
  created_at timestamptz not null default now()
);

create table branch_hours (
  branch_id uuid not null references branches (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null,
  primary key (branch_id, weekday)
);

-- Zones belong to ONE branch. Zones of different branches may overlap (D-OVERLAP).
create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches (id) on delete cascade,
  name text not null,
  area geography (polygon, 4326) not null,
  fee_tetri integer check (fee_tetri >= 0),             -- null = not confirmed yet, orders blocked
  min_order_tetri integer not null default 0 check (min_order_tetri >= 0),
  free_from_tetri integer check (free_from_tetri >= 0),
  extra_minutes integer not null default 0 check (extra_minutes >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index delivery_zones_area_gix on delivery_zones using gist (area);
create index delivery_zones_branch_idx on delivery_zones (branch_id);

create table staff_branches (
  user_id uuid not null references profiles (id) on delete cascade,
  branch_id uuid not null references branches (id) on delete cascade,
  primary key (user_id, branch_id)
);

create table couriers (
  user_id uuid primary key references profiles (id) on delete cascade,
  home_branch_id uuid references branches (id),          -- D-COURIERPOOL
  status text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  created_at timestamptz not null default now()
);

-- Shared catalogue + per-branch availability (D-BRANCHPRICE: optional override).
create table categories (
  id uuid primary key default gen_random_uuid(),
  name_ka text not null,
  sort_order integer not null default 0
);

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories (id),
  name text not null,
  description_ka text,
  price_tetri integer not null check (price_tetri >= 0),
  old_price_tetri integer check (old_price_tetri >= 0),
  image_path text,
  price_source text not null default 'unapproved', -- 'approved' only after the owner confirms
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table branch_products (
  branch_id uuid not null references branches (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  is_available boolean not null default true,
  price_override_tetri integer check (price_override_tetri >= 0),
  primary key (branch_id, product_id)
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  label text,
  street text not null,
  entrance text,
  floor text,
  apartment text,
  comment text,
  location geography (point, 4326) not null,
  created_at timestamptz not null default now()
);
create index addresses_user_idx on addresses (user_id);

create table orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,                        -- e.g. B1-000042
  customer_id uuid not null references profiles (id),
  branch_id uuid not null references branches (id),
  zone_id uuid not null references delivery_zones (id),
  courier_id uuid references couriers (user_id),
  status order_status not null,
  payment_method payment_method not null,
  payment_status payment_status not null default 'unpaid',
  address_snapshot jsonb not null,
  delivery_point geography (point, 4326) not null,
  notes text,
  subtotal_tetri integer not null check (subtotal_tetri >= 0),
  delivery_fee_tetri integer not null check (delivery_fee_tetri >= 0),
  discount_tetri integer not null default 0 check (discount_tetri >= 0),
  total_tetri integer not null check (total_tetri >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_branch_status_idx on orders (branch_id, status, created_at desc);
create index orders_customer_idx on orders (customer_id, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references products (id),
  name_snapshot text not null,
  unit_price_tetri integer not null check (unit_price_tetri >= 0),
  quantity integer not null check (quantity between 1 and 50)
);
create index order_items_order_idx on order_items (order_id);

create table order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders (id) on delete cascade,
  from_status order_status,
  to_status order_status not null,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on order_events (order_id);

-- ===== migrations/0002_functions.sql =====
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

-- ===== migrations/0003_rls.sql =====
-- Deny by default: enable RLS everywhere, then allow only what each role needs.
alter table profiles enable row level security;
alter table branches enable row level security;
alter table branch_hours enable row level security;
alter table delivery_zones enable row level security;
alter table staff_branches enable row level security;
alter table couriers enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table branch_products enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_events enable row level security;

-- profiles: own row. Role/phone cannot be changed by the user (trigger below).
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_super_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function protect_profile_fields() returns trigger language plpgsql as
$$ begin
  -- auth.uid() is null for service role / SQL editor / migrations: those are trusted backend contexts
  if auth.uid() is not null and not is_super_admin() and (new.role is distinct from old.role or new.phone is distinct from old.phone) then
    raise exception 'forbidden_field';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on profiles for each row execute function protect_profile_fields();

-- Public catalogue reads (active only). Writes: super admin only.
create policy branches_read on branches for select using (is_active or is_super_admin());
create policy branches_admin on branches for all using (is_super_admin()) with check (is_super_admin());
create policy hours_read on branch_hours for select using (true);
create policy hours_admin on branch_hours for all using (is_super_admin()) with check (is_super_admin());
create policy zones_read on delivery_zones for select using (is_active or is_super_admin());
create policy zones_admin on delivery_zones for all using (is_super_admin()) with check (is_super_admin());
create policy categories_read on categories for select using (true);
create policy categories_admin on categories for all using (is_super_admin()) with check (is_super_admin());
create policy products_read on products for select using (is_active or is_super_admin());
create policy products_admin on products for all using (is_super_admin()) with check (is_super_admin());

-- Branch availability: anyone reads; branch staff may toggle availability of their own branch only.
create policy bp_read on branch_products for select using (true);
create policy bp_staff_update on branch_products for update
  using (is_branch_staff(branch_id)) with check (is_branch_staff(branch_id));
create policy bp_admin on branch_products for all using (is_super_admin()) with check (is_super_admin());
-- Staff must not change price overrides: enforced by trigger.
create or replace function protect_branch_product_price() returns trigger language plpgsql as
$$ begin
  if auth.uid() is not null and not is_super_admin() and new.price_override_tetri is distinct from old.price_override_tetri then
    raise exception 'price_change_forbidden';
  end if;
  return new;
end $$;
create trigger bp_protect_price before update on branch_products for each row execute function protect_branch_product_price();

create policy staff_branches_read on staff_branches for select using (user_id = auth.uid() or is_super_admin());
create policy staff_branches_admin on staff_branches for all using (is_super_admin()) with check (is_super_admin());
create policy couriers_read on couriers for select
  using (user_id = auth.uid() or is_super_admin() or (home_branch_id is not null and is_branch_staff(home_branch_id)));
create policy couriers_admin on couriers for all using (is_super_admin()) with check (is_super_admin());

-- addresses: owner only
create policy addresses_owner on addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- orders: customer sees own; staff see their branch; courier sees assigned. No direct writes (use functions).
create policy orders_customer_read on orders for select using (customer_id = auth.uid());
create policy orders_staff_read on orders for select using (is_branch_staff(branch_id));
create policy orders_courier_read on orders for select using (courier_id = auth.uid());
create policy order_items_read on order_items for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_id = auth.uid() or is_branch_staff(o.branch_id) or o.courier_id = auth.uid())));
create policy order_events_read on order_events for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_id = auth.uid() or is_branch_staff(o.branch_id) or o.courier_id = auth.uid())));

-- Tables have no INSERT/UPDATE policy for orders/items/events: only SECURITY DEFINER functions write them.
revoke insert, update, delete on orders, order_items, order_events from anon, authenticated;

-- New auth user -> customer profile
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  insert into profiles (id, phone) values (new.id, new.phone) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ===== migrations/0004_demo_mode.sql =====
-- DEMO MODE: lets a demo (for the restaurant owners) simulate card payment and order progress.
-- Safe by default: app_settings.demo_mode = 'false', and the demo_* functions refuse to run unless it is 'true'.
-- Real payments (provider webhooks) and real staff status changes (transition_order) are unaffected.
create table if not exists app_settings (
  key text primary key,
  value text not null
);
alter table app_settings enable row level security;
create policy app_settings_read on app_settings for select using (true);
create policy app_settings_admin on app_settings for all using (is_super_admin()) with check (is_super_admin());
insert into app_settings (key, value) values ('demo_mode', 'false') on conflict (key) do nothing;

create or replace function is_demo_mode() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select value = 'true' from app_settings where key = 'demo_mode'), false) $$;

-- Simulated card payment for the customer's own pending order. No card data is ever collected.
create or replace function demo_pay_order(p_order_id uuid, p_success boolean) returns void
language plpgsql security definer set search_path = public as
$$
declare v_order orders;
begin
  if not is_demo_mode() then raise exception 'demo_disabled'; end if;
  select * into v_order from orders where id = p_order_id and customer_id = auth.uid() for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status <> 'pending_payment' then raise exception 'invalid_state'; end if;
  if p_success then
    update orders set status = 'placed', payment_status = 'paid', updated_at = now() where id = p_order_id;
    insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, 'pending_payment', 'placed', auth.uid());
  else
    update orders set status = 'payment_failed', payment_status = 'failed', updated_at = now() where id = p_order_id;
    insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, 'pending_payment', 'payment_failed', auth.uid());
  end if;
end
$$;

-- Moves the customer's own order one step along the happy path, so the tracking screen can be demonstrated.
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
    when 'ready_for_pickup' then 'out_for_delivery' when 'out_for_delivery' then 'delivered' else null end;
  if v_next is null then raise exception 'invalid_state'; end if;
  update orders set status = v_next, updated_at = now() where id = p_order_id;
  insert into order_events (order_id, from_status, to_status, actor_id) values (p_order_id, v_order.status, v_next, auth.uid());
  return v_next;
end
$$;

revoke all on function demo_pay_order, demo_advance_order from public;
grant execute on function is_demo_mode to anon, authenticated;
grant execute on function demo_pay_order, demo_advance_order to authenticated;

-- resolve_branches now also tells the app whether cash on delivery is available at that branch.
drop function if exists resolve_branches(double precision, double precision);
create function resolve_branches(p_lat double precision, p_lng double precision)
returns table (
  branch_id uuid, branch_name text, zone_id uuid, zone_name text,
  fee_tetri integer, min_order_tetri integer, free_from_tetri integer,
  extra_minutes integer, distance_m double precision, can_order boolean, cod_enabled boolean
)
language sql stable security definer set search_path = public as
$$
  with pt as (select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g)
  select distinct on (b.id)
         b.id, b.name, z.id, z.name, z.fee_tetri, z.min_order_tetri, z.free_from_tetri,
         z.extra_minutes,
         case when b.location is null then null else st_distance(b.location, pt.g) end,
         (b.is_active and b.accepts_orders and z.fee_tetri is not null),
         b.cod_enabled
  from pt
  join delivery_zones z on z.is_active and st_covers(z.area, pt.g)
  join branches b on b.id = z.branch_id and b.is_active
  order by b.id, z.fee_tetri nulls last
$$;
revoke all on function resolve_branches from public;
grant execute on function resolve_branches to anon, authenticated;

-- Realtime: customers and staff get live order updates (RLS still applies).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table orders;
  end if;
end $$;

-- ===== migrations/0005_product_photos.sql =====
-- Real product photos (Gochit's Wolt page, Dighomi branch). Internal demo use, pending restaurant approval.
-- Updates image_path by product name; products without a photo keep NULL.
update products set image_path = 'menu/10f2afe32c7cd92c.jpg' where name = 'Double Smashed';
update products set image_path = 'menu/2ea18f432c1d6874.jpg' where name = 'The Monster';
update products set image_path = 'menu/624137009c5d1765.jpg' where name = 'Gochits Burger';
update products set image_path = 'menu/8cbc29619060d84d.jpg' where name = 'Giant Burger';
update products set image_path = 'menu/9a469a561a0ed9bf.jpg' where name = 'Jalapeno Triple';
update products set image_path = 'menu/1025b4e04122acf9.jpg' where name = 'Double Chicken Burger';
update products set image_path = 'menu/e349d19dac6679a3.jpg' where name = 'Double Bacon Cheesburger';
update products set image_path = 'menu/ff8075632782d94d.jpg' where name = 'BBQ';
update products set image_path = 'menu/f932360b9a252db1.jpg' where name = 'Chicken Burger';
update products set image_path = 'menu/b9c8252075dfe533.jpg' where name = 'Mexican Hot';
update products set image_path = 'menu/b227f222788dbae1.jpg' where name = 'Chicken Burger Spicy';
update products set image_path = 'menu/9931c181d5e2d48f.jpg' where name = 'Pipipow Double Burger';
update products set image_path = 'menu/e2656defe26c14bd.jpg' where name = 'Double Smashed Combo';
update products set image_path = 'menu/f2a6afdee784f32a.jpg' where name = 'Gochits Burger Combo';
update products set image_path = 'menu/b5054ae101db606e.jpg' where name = 'Chicken Burger Combo';
update products set image_path = 'menu/2a1b9d2da9a1e510.jpg' where name = 'Double Chicken Burger Combo';
update products set image_path = 'menu/b4908a2ba229729a.jpg' where name = 'The Monster Combo';
update products set image_path = 'menu/8cbc29619060d84d.jpg' where name = 'Giant Burger Combo';
update products set image_path = 'menu/ab9067750f21cf0e.jpg' where name = 'BBQ Double Combo';
update products set image_path = 'menu/6e66c4f714cdea3a.jpg' where name = 'Mexican Hot Combo';
update products set image_path = 'menu/923a0b299936b3cf.jpg' where name = 'Jalapeno Triple Combo';
update products set image_path = 'menu/4aeda16c2132ced1.jpg' where name = 'Pipipow Double Burger Combo';
update products set image_path = 'menu/67ed63c74cfa427f.jpg' where name = 'ქათმის როლი';
update products set image_path = 'menu/ca451fdfad55ec09.jpg' where name = 'ქათმის ცხარე როლი';
update products set image_path = 'menu/2ad63c7dd2ee7576.jpg' where name = 'საქონლის ვრეპი';
update products set image_path = 'menu/2ad63c7dd2ee7576.jpg' where name = 'საქონლის ვრეპი ყველის სოუსით';
update products set image_path = null where name = 'ქათმის ვრეპი';
update products set image_path = null where name = 'ქათმის ვრეპი ცხარე';
update products set image_path = null where name = 'ქათმის ბოული';
update products set image_path = null where name = 'ქათმის ფრეშ ბოული';
update products set image_path = 'menu/1f736a5eb2011b6f.jpg' where name = 'კარტოფილი ფრი დიდი 350გრ.';
update products set image_path = 'menu/1f736a5eb2011b6f.jpg' where name = 'კარტოფილი ფრი პატარა 200გრ.';
update products set image_path = 'menu/5646be088b755e1f.jpg' where name = 'კარტოფილი ფრი მდნარი ყველით და ჰალაპენიოთი';
update products set image_path = 'menu/832c2f8f60babb2b.jpg' where name = 'ყველის ცხელი სოუსი 60გრ';
update products set image_path = 'menu/5fc77ec6946fde5b.jpg' where name = 'მაიონეზი 30გრ';
update products set image_path = 'menu/f239b299fb2d0923.jpg' where name = 'ჰალაპენიო 30გრ';
update products set image_path = 'menu/4c90ceae71477254.jpg' where name = 'კეტჩუპი 30გრ';
update products set image_path = 'menu/1e8cc5fda47cb4ab.jpg' where name = 'BBQ სოუსი 30გრ';
update products set image_path = 'menu/0f54b406a5b5efa3.jpg' where name = 'სპეც სოუსი 30გრ';
update products set image_path = 'menu/deddadc297c179ef.jpg' where name = 'სპეც სოუსი ცხარე 30გრ';
update products set image_path = 'menu/1ec21936398b1171.jpg' where name = 'კოკა-კოლა 0.33 ლ';
update products set image_path = 'menu/06eea84f6395d969.jpg' where name = 'კოკა-კოლა ზერო 0.33 ლ';
update products set image_path = 'menu/3b6f26c3e3012174.jpg' where name = 'ფანტა 0.33 ლ';
update products set image_path = 'menu/218733aefce98582.jpg' where name = 'სპრაიტი 0.33 ლ';
update products set image_path = null where name = 'Burn';
update products set image_path = 'menu/a28e0c3f83146923.jpg' where name = 'კოკა-კოლა 0.5 ლ';
update products set image_path = 'menu/72b9c332776a3259.jpg' where name = 'კოკა-კოლა ზერო 0.5 ლ';
update products set image_path = 'menu/46ac7bced56dc390.jpg' where name = 'ფანტა 0.5 ლ';
update products set image_path = 'menu/7302333c567fbf34.jpg' where name = 'სპრაიტი 0.5 ლ';
update products set image_path = 'menu/9b90f2bf6aa9da7c.jpg' where name = 'მთის წყალი 0.5 ლ';

-- Branch names from Wolt/Glovo pages (unconfirmed; addresses/hours still to be confirmed by the owner).
update branches set name = 'გოჩიტ''ს დიღომი' where code = 'B1';
update branches set name = 'გოჩიტ''ს თავისუფლების მოედანი' where code = 'B2';
update branches set name = 'გოჩიტ''ს ვარკეთილი' where code = 'B3';
update branches set name = 'გოჩიტ''ს ისანი' where code = 'B4';
update branches set name = 'გოჩიტ''ს მონსტრ ბურგერს ვაჟა-ფშაველა' where code = 'B5';
update branches set name = 'გოჩიტ''ს ვეკუას ქუჩა' where code = 'B6';

-- ===== migrations/0006_customer_features.sql =====
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

-- ===== seed.sql =====
-- Dev/launch seed. Menu = Wolt observed snapshot (2026-10-15), prices NOT approved (price_source='unapproved').
-- Branch names come from Wolt/Glovo pages; addresses/hours/phones still to be confirmed by the owner.

insert into branches (code,name) values ('B1','გოჩიტ''ს დიღომი') on conflict (code) do nothing;
insert into branches (code,name) values ('B2','გოჩიტ''ს თავისუფლების მოედანი') on conflict (code) do nothing;
insert into branches (code,name) values ('B3','გოჩიტ''ს ვარკეთილი') on conflict (code) do nothing;
insert into branches (code,name) values ('B4','გოჩიტ''ს ისანი') on conflict (code) do nothing;
insert into branches (code,name) values ('B5','გოჩიტ''ს მონსტრ ბურგერს ვაჟა-ფშაველა') on conflict (code) do nothing;
insert into branches (code,name) values ('B6','გოჩიტ''ს ვეკუას ქუჩა') on conflict (code) do nothing;

insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000100','ბურგერები',0) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000101','კომბო',1) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000102','ვრეპები და როლები',2) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000103','ბოულები',3) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000104','გარნირები',4) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000105','სოუსები',5) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000106','სასმელები',6) on conflict (id) do nothing;

insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000200','00000000-0000-0000-0000-000000000100','Double Smashed','სპეც სოუსი, ნატურალური საქონლის ხორცი 2 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი',1746,2495,'menu/10f2afe32c7cd92c.jpg',0) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000100','The Monster','სპეც სოუსი, ნატურალური საქონლის ხორცი 3 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი',2289,3270,'menu/2ea18f432c1d6874.jpg',1) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000100','Gochits Burger','სპეც სოუსი, ნატურალური საქონლის ხორცი, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი',1379,1970,'menu/624137009c5d1765.jpg',2) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000100','Giant Burger','სპეც სოუსი, ნატურალური საქონლის ხორცი 5 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი',3493,4990,'menu/8cbc29619060d84d.jpg',3) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000100','Jalapeno Triple','სპეც სოუსი, ნატურალური საქონლის ხორცი 3 ფენა, ყველი ჩედარი ორმაგი, აისბერგი, ბეკონი, ჰალაპენიო, ხახვი, პომიდორი',2499,3570,'menu/9a469a561a0ed9bf.jpg',4) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000205','00000000-0000-0000-0000-000000000100','Double Chicken Burger','ქათმის ფილე, სუნელები, ბოსტნეული, მჟავე კიტრი, სპეც სოუსი',1470,2100,'menu/1025b4e04122acf9.jpg',5) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000206','00000000-0000-0000-0000-000000000100','Double Bacon Cheesburger','საქონლის ხორცი 200გრ, ჩედარი 4 ფენა, ბეკონი 2ცალი, მაიონეზი, სპეც სოუსი',1883,2690,'menu/e349d19dac6679a3.jpg',6) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000207','00000000-0000-0000-0000-000000000100','BBQ','სპეც სოუსი, ბარბექიუს სოუსი, ნატურალური საქონლის ხორცი 2 ფენა შერეული მოხრაკულ ბეკონში, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი',2709,3870,'menu/ff8075632782d94d.jpg',7) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000208','00000000-0000-0000-0000-000000000100','Chicken Burger','ქათმის ფილე, სუნელები, ბოსტნეული, მჟავე კიტრი, სპეც სოუსი',1400,2000,'menu/f932360b9a252db1.jpg',8) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000209','00000000-0000-0000-0000-000000000100','Mexican Hot','ტკბილი მდოგვი, სპეც სოუსი, ჰალაპენიო, ტობასკო, ნატურალური საქონლის ხორცი 2 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი',2289,3270,'menu/b9c8252075dfe533.jpg',9) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000210','00000000-0000-0000-0000-000000000100','Chicken Burger Spicy','ქათმის ფილე, სუნელები, ბოსტნეული, ჰალაპენიო, ცხარე სპეცსოუსი',1400,2000,'menu/b227f222788dbae1.jpg',10) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000211','00000000-0000-0000-0000-000000000100','Pipipow Double Burger','ბურგერის პური, აისბერგი, პომიდორი, ნატურალური საქონლის ხორცი, ჩედარი, მჟავე კიტრი, ბეკონი, სპეც სოუსი, ბარბექიუ სოუსი, კეტჩუპი, მდოგვი',2800,4000,'menu/9931c181d5e2d48f.jpg',11) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000212','00000000-0000-0000-0000-000000000101','Double Smashed Combo','სპეც სოუსი, ნატურალური საქონლის ხორცი 2 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი, ფრი და სასმელი',3390,null,'menu/e2656defe26c14bd.jpg',12) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000213','00000000-0000-0000-0000-000000000101','Gochits Burger Combo','სპეც სოუსი, ნატურალური საქონლის ხორცი, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი, ფრი და სასმელი',2790,null,'menu/f2a6afdee784f32a.jpg',13) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000214','00000000-0000-0000-0000-000000000101','Chicken Burger Combo','ქათმის ფილე, სუნელები, ბოსტნეული, მჟავე კიტრი, სპეც სოუსი',2500,null,'menu/b5054ae101db606e.jpg',14) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000215','00000000-0000-0000-0000-000000000101','Double Chicken Burger Combo','ქათმის ფილე, სუნელები, ბოსტნეული, მჟავე კიტრი, სპეც სოუსი',2800,null,'menu/2a1b9d2da9a1e510.jpg',15) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000216','00000000-0000-0000-0000-000000000101','The Monster Combo','სპეც სოუსი, ნატურალური საქონლის ხორცი 3 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი და კარტოფილი ფრი + სასმელი',4090,null,'menu/b4908a2ba229729a.jpg',16) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000217','00000000-0000-0000-0000-000000000101','Giant Burger Combo','სპეც სოუსი, ნატურალური საქონლის ხორცი 5 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი და კარტოფილი ფრი, სასმელი',5590,null,'menu/8cbc29619060d84d.jpg',17) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000218','00000000-0000-0000-0000-000000000101','BBQ Double Combo','სპეც სოუსი, ბარბექიუს სოუსი, ნატურალური საქონლის ხორცი 2 ფენა შერეული მოხრაკულ ბეკონში, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი და კარტოფილი ფრი, სასმელი',4990,null,'menu/ab9067750f21cf0e.jpg',18) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000219','00000000-0000-0000-0000-000000000101','Mexican Hot Combo','ტკბილი მდოგვი, სპეც სოუსი, ჰალაპენიო, ტობასკო, ნატურალური საქონლის ხორცი 2 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი და კარტოფილი ფრი, სასმელი',3990,null,'menu/6e66c4f714cdea3a.jpg',19) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000220','00000000-0000-0000-0000-000000000101','Jalapeno Triple Combo','სპეც სოუსი, ნატურალური საქონლის ხორცი 3 ფენა, ყველი ჩედარი ორმაგი, აისბერგი, ჰალაპენიო, ხახვი, კიტრი და კარტოფილი, პომიდორი, ფრი, სასმელი',4390,null,'menu/923a0b299936b3cf.jpg',20) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000221','00000000-0000-0000-0000-000000000101','Pipipow Double Burger Combo','ბურგერის პური, აისბერგი, პომიდორი, ნატურალური საქონლის ხორცი, ჩედარი, მჟავე კიტრი, ბეკონი, სპეც სოუსი, ბარბექიუ სოუსი, კეტჩუპი, მდოგვი',3590,null,'menu/4aeda16c2132ced1.jpg',21) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000222','00000000-0000-0000-0000-000000000102','ქათმის როლი','ქათმის ფილე, სუნელები, ბოსტნეული, მჟავე კიტრი, სპეც სოუსი',1850,null,'menu/67ed63c74cfa427f.jpg',22) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000223','00000000-0000-0000-0000-000000000102','ქათმის ცხარე როლი','ქათმის ფილე, სუნელები, ბოსტნეული, ჰალაპენიო, ცხარე სპეცსოუსი',1850,null,'menu/ca451fdfad55ec09.jpg',23) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000224','00000000-0000-0000-0000-000000000102','საქონლის ვრეპი','საქონლის ფარში, ყველი, ბოსტნეული, სპეც სოუსი, ბარბექიუ სოუსი, მჟავე კიტრი',1500,null,'menu/2ad63c7dd2ee7576.jpg',24) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000225','00000000-0000-0000-0000-000000000102','საქონლის ვრეპი ყველის სოუსით','საქონლის ფარში, ყველი, ბოსტნეული, სპეც სოუსი, ბარბექიუ სოუსი, მჟავე კიტრი, ყველის სოუსი',1500,null,'menu/2ad63c7dd2ee7576.jpg',25) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000226','00000000-0000-0000-0000-000000000102','ქათმის ვრეპი','ქათმის ფილე, ყველი, ბოსტნეული, სპეც სოუსი',2100,null,null,26) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000227','00000000-0000-0000-0000-000000000102','ქათმის ვრეპი ცხარე','ქათმის ფილე, ყველი, ბოსტნეული, ცხარე სპეც სოუსი',2100,null,null,27) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000228','00000000-0000-0000-0000-000000000103','ქათმის ბოული','ფრი, ქათმის ფილე, სპეც სოუსი',1750,null,null,28) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000229','00000000-0000-0000-0000-000000000103','ქათმის ფრეშ ბოული','ქათმის ფილე, სპეც სოუსი, აისბერგი, პომიდორი, მჟავე კიტრი',1450,null,null,29) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000230','00000000-0000-0000-0000-000000000104','კარტოფილი ფრი დიდი 350გრ.',null,850,null,'menu/1f736a5eb2011b6f.jpg',30) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000231','00000000-0000-0000-0000-000000000104','კარტოფილი ფრი პატარა 200გრ.',null,650,null,'menu/1f736a5eb2011b6f.jpg',31) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000232','00000000-0000-0000-0000-000000000104','კარტოფილი ფრი მდნარი ყველით და ჰალაპენიოთი',null,1650,null,'menu/5646be088b755e1f.jpg',32) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000233','00000000-0000-0000-0000-000000000105','ყველის ცხელი სოუსი 60გრ',null,700,null,'menu/832c2f8f60babb2b.jpg',33) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000234','00000000-0000-0000-0000-000000000105','მაიონეზი 30გრ',null,300,null,'menu/5fc77ec6946fde5b.jpg',34) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000235','00000000-0000-0000-0000-000000000105','ჰალაპენიო 30გრ',null,350,null,'menu/f239b299fb2d0923.jpg',35) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000236','00000000-0000-0000-0000-000000000105','კეტჩუპი 30გრ',null,300,null,'menu/4c90ceae71477254.jpg',36) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000237','00000000-0000-0000-0000-000000000105','BBQ სოუსი 30გრ',null,300,null,'menu/1e8cc5fda47cb4ab.jpg',37) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000238','00000000-0000-0000-0000-000000000105','სპეც სოუსი 30გრ',null,300,null,'menu/0f54b406a5b5efa3.jpg',38) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000239','00000000-0000-0000-0000-000000000105','სპეც სოუსი ცხარე 30გრ',null,300,null,'menu/deddadc297c179ef.jpg',39) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000240','00000000-0000-0000-0000-000000000106','კოკა-კოლა 0.33 ლ',null,400,null,'menu/1ec21936398b1171.jpg',40) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000241','00000000-0000-0000-0000-000000000106','კოკა-კოლა ზერო 0.33 ლ',null,400,null,'menu/06eea84f6395d969.jpg',41) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000242','00000000-0000-0000-0000-000000000106','ფანტა 0.33 ლ',null,400,null,'menu/3b6f26c3e3012174.jpg',42) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000243','00000000-0000-0000-0000-000000000106','სპრაიტი 0.33 ლ',null,400,null,'menu/218733aefce98582.jpg',43) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000244','00000000-0000-0000-0000-000000000106','Burn',null,450,null,null,44) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000245','00000000-0000-0000-0000-000000000106','კოკა-კოლა 0.5 ლ',null,400,null,'menu/a28e0c3f83146923.jpg',45) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000246','00000000-0000-0000-0000-000000000106','კოკა-კოლა ზერო 0.5 ლ',null,350,null,'menu/72b9c332776a3259.jpg',46) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000247','00000000-0000-0000-0000-000000000106','ფანტა 0.5 ლ',null,400,null,'menu/46ac7bced56dc390.jpg',47) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000248','00000000-0000-0000-0000-000000000106','სპრაიტი 0.5 ლ',null,400,null,'menu/7302333c567fbf34.jpg',48) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000249','00000000-0000-0000-0000-000000000106','მთის წყალი 0.5 ლ',null,300,null,'menu/9b90f2bf6aa9da7c.jpg',49) on conflict (id) do nothing;

-- every product available in every branch by default
insert into branch_products (branch_id,product_id) select b.id,p.id from branches b cross join products p on conflict do nothing;

-- ===== migrations/0013_pickup.sql =====
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

-- ===== migrations/0014_merchants.sql =====
-- Marketplace: many businesses ("merchants") on one platform. Each branch and each menu category belongs to exactly one merchant.
-- Gochit's becomes the first merchant automatically; everything that exists keeps working.

create table if not exists merchants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  name text not null,
  kind text not null default 'restaurant' check (kind in ('restaurant', 'cafe', 'grocery', 'pharmacy', 'flowers', 'other')),
  description text,
  logo_path text,
  cover_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

insert into merchants (id, slug, name, kind, description, sort_order)
values ('00000000-0000-0000-0000-0000000000a1', 'gochits', 'Gochit''s', 'restaurant', 'ბურგერები, ვრეპები და ბოულები', 0)
on conflict (id) do nothing;

alter table branches add column if not exists merchant_id uuid references merchants (id);
alter table categories add column if not exists merchant_id uuid references merchants (id);
update branches set merchant_id = '00000000-0000-0000-0000-0000000000a1' where merchant_id is null;
update categories set merchant_id = '00000000-0000-0000-0000-0000000000a1' where merchant_id is null;
-- the default keeps older panel versions (that do not send merchant_id yet) working
alter table branches alter column merchant_id set default '00000000-0000-0000-0000-0000000000a1';
alter table categories alter column merchant_id set default '00000000-0000-0000-0000-0000000000a1';
alter table branches alter column merchant_id set not null;
alter table categories alter column merchant_id set not null;
create index if not exists branches_merchant_idx on branches (merchant_id);
create index if not exists categories_merchant_idx on categories (merchant_id);

-- A product can only be offered by branches of the merchant that owns its category.
create or replace function branch_products_merchant_check() returns trigger
language plpgsql as
$$
begin
  if (select b.merchant_id from branches b where b.id = new.branch_id)
     is distinct from (select c.merchant_id from products p join categories c on c.id = p.category_id where p.id = new.product_id) then
    raise exception 'merchant_mismatch';
  end if;
  return new;
end
$$;
drop trigger if exists branch_products_merchant on branch_products;
create trigger branch_products_merchant before insert or update of branch_id, product_id on branch_products
  for each row execute function branch_products_merchant_check();

alter table merchants enable row level security;
drop policy if exists merchants_read on merchants;
drop policy if exists merchants_admin on merchants;
create policy merchants_read on merchants for select using (is_active or is_super_admin());
create policy merchants_admin on merchants for all using (is_super_admin()) with check (is_super_admin());

-- 1. App: the list of businesses for the home screen.
create or replace function list_merchants()
returns table (id uuid, slug text, name text, kind text, description text, logo_path text, cover_path text,
               branch_count integer, any_open boolean, any_accepting boolean, pickup_available boolean)
language sql stable security definer set search_path = public as
$$
  select m.id, m.slug, m.name, m.kind, m.description, m.logo_path, m.cover_path,
         count(b.id)::integer,
         coalesce(bool_or(branch_is_open(b.id)), false),
         coalesce(bool_or(b.accepts_orders), false),
         coalesce(bool_or(b.pickup_enabled and b.accepts_orders), false)
    from merchants m
    left join branches b on b.merchant_id = m.id and b.is_active
   where m.is_active
   group by m.id
   order by m.sort_order, m.name
$$;
revoke all on function list_merchants from public;
grant execute on function list_merchants to anon, authenticated;

-- 2. Branch lists carry the merchant.
drop function if exists list_branches();
create function list_branches()
returns table (id uuid, name text, address text, phone text, accepts_orders boolean, is_open boolean,
               pickup_enabled boolean, pickup_discount_percent integer, lat double precision, lng double precision, merchant_id uuid)
language sql stable security definer set search_path = public as
$$
  select b.id, b.name, b.address, b.phone, b.accepts_orders, branch_is_open(b.id),
         b.pickup_enabled, b.pickup_discount_percent, st_y(b.location::geometry), st_x(b.location::geometry), b.merchant_id
    from branches b join merchants m on m.id = b.merchant_id and m.is_active
   where b.is_active order by b.code
$$;
revoke all on function list_branches from public, anon;
grant execute on function list_branches to anon, authenticated;

drop function if exists resolve_branches(double precision, double precision);
create function resolve_branches(p_lat double precision, p_lng double precision)
returns table (
  branch_id uuid, branch_name text, zone_id uuid, zone_name text,
  fee_tetri integer, min_order_tetri integer, free_from_tetri integer,
  extra_minutes integer, distance_m double precision, can_order boolean, cod_enabled boolean, is_open boolean, merchant_id uuid
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
         branch_is_open(b.id),
         b.merchant_id
  from pt
  join delivery_zones z on z.is_active and st_covers(z.area, pt.g)
  join branches b on b.id = z.branch_id and b.is_active
  join merchants m on m.id = b.merchant_id and m.is_active
  order by b.id, z.fee_tetri nulls last
$$;
revoke all on function resolve_branches from public;
grant execute on function resolve_branches to anon, authenticated;

-- 3. Admin: merchants.
create or replace function admin_merchants() returns table (
  id uuid, slug text, name text, kind text, description text, logo_path text, cover_path text,
  is_active boolean, sort_order integer, branch_count integer)
language plpgsql security definer set search_path = public as
$$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query select m.id, m.slug, m.name, m.kind, m.description, m.logo_path, m.cover_path, m.is_active, m.sort_order,
    (select count(*)::integer from branches b where b.merchant_id = m.id) from merchants m order by m.sort_order, m.name;
end
$$;

create or replace function admin_save_merchant(
  p_id uuid, p_slug text, p_name text, p_kind text, p_description text,
  p_logo_path text, p_cover_path text, p_is_active boolean, p_sort_order integer
) returns uuid language plpgsql security definer set search_path = public as
$$
declare v_id uuid;
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'name_required'; end if;
  if p_id is null then
    insert into merchants (slug, name, kind, description, logo_path, cover_path, is_active, sort_order)
    values (lower(btrim(p_slug)), btrim(p_name), coalesce(p_kind, 'restaurant'), nullif(btrim(p_description), ''),
            nullif(btrim(p_logo_path), ''), nullif(btrim(p_cover_path), ''), coalesce(p_is_active, true), coalesce(p_sort_order, 0))
    returning id into v_id;
  else
    update merchants set slug = lower(btrim(p_slug)), name = btrim(p_name), kind = coalesce(p_kind, 'restaurant'),
      description = nullif(btrim(p_description), ''), logo_path = nullif(btrim(p_logo_path), ''), cover_path = nullif(btrim(p_cover_path), ''),
      is_active = coalesce(p_is_active, true), sort_order = coalesce(p_sort_order, 0)
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'merchant_not_found'; end if;
  end if;
  return v_id;
end
$$;

-- 4. Admin branches carry the merchant; the save function takes it (optional, so older panels still work).
drop function if exists admin_branches();
create function admin_branches() returns table (
  id uuid, code text, name text, address text, phone text, lat double precision, lng double precision,
  is_active boolean, accepts_orders boolean, cod_enabled boolean, pickup_enabled boolean, pickup_discount_percent integer,
  merchant_id uuid, merchant_name text
) language plpgsql security definer set search_path = public as
$$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query select b.id, b.code, b.name, b.address, b.phone, st_y(b.location::geometry), st_x(b.location::geometry),
    b.is_active, b.accepts_orders, b.cod_enabled, b.pickup_enabled, b.pickup_discount_percent, b.merchant_id, m.name
    from branches b join merchants m on m.id = b.merchant_id order by m.sort_order, b.code;
end
$$;

drop function if exists admin_save_branch(uuid, text, text, text, text, double precision, double precision, boolean, boolean, boolean, boolean, integer);
create function admin_save_branch(
  p_id uuid, p_code text, p_name text, p_address text, p_phone text, p_lat double precision, p_lng double precision,
  p_is_active boolean, p_accepts_orders boolean, p_cod_enabled boolean,
  p_pickup_enabled boolean default true, p_pickup_discount_percent integer default 0, p_merchant_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as
$$
declare v_loc geography; v_id uuid;
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  if coalesce(p_pickup_discount_percent, 0) not between 0 and 50 then raise exception 'bad_discount'; end if;
  v_loc := case when p_lat is null or p_lng is null then null else st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end;
  if p_id is null then
    insert into branches (code, name, address, phone, location, is_active, accepts_orders, cod_enabled, pickup_enabled, pickup_discount_percent, merchant_id)
    values (upper(btrim(p_code)), p_name, nullif(btrim(p_address), ''), nullif(btrim(p_phone), ''), v_loc, coalesce(p_is_active, true), coalesce(p_accepts_orders, false), coalesce(p_cod_enabled, false),
            coalesce(p_pickup_enabled, true), coalesce(p_pickup_discount_percent, 0),
            coalesce(p_merchant_id, '00000000-0000-0000-0000-0000000000a1'))
    returning id into v_id;
  else
    if p_merchant_id is not null and p_merchant_id <> (select merchant_id from branches where id = p_id)
       and exists (select 1 from branch_products where branch_id = p_id) then
      raise exception 'merchant_has_products';
    end if;
    update branches set name = p_name, address = nullif(btrim(p_address), ''), phone = nullif(btrim(p_phone), ''), location = v_loc,
      is_active = coalesce(p_is_active, true), accepts_orders = coalesce(p_accepts_orders, false), cod_enabled = coalesce(p_cod_enabled, false),
      pickup_enabled = coalesce(p_pickup_enabled, true), pickup_discount_percent = coalesce(p_pickup_discount_percent, 0),
      merchant_id = coalesce(p_merchant_id, merchant_id)
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'branch_not_found'; end if;
  end if;
  return v_id;
end
$$;

-- 5. A new branch of a merchant starts with that merchant's whole menu switched on.
create or replace function branch_seed_menu() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  insert into branch_products (branch_id, product_id)
  select new.id, p.id from products p join categories c on c.id = p.category_id where c.merchant_id = new.merchant_id
  on conflict do nothing;
  return new;
end
$$;
drop trigger if exists branches_seed_menu on branches;
create trigger branches_seed_menu after insert on branches for each row execute function branch_seed_menu();

revoke all on function admin_merchants, admin_save_merchant, admin_branches, admin_save_branch from public, anon;
grant execute on function admin_merchants, admin_save_merchant, admin_branches, admin_save_branch to authenticated;
