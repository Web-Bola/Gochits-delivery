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

-- ===== seed.sql =====
-- Dev/launch seed. Menu = Wolt observed snapshot (2026-10-15), prices NOT approved (price_source='unapproved').
-- Branch names/addresses/phones are placeholders until the owner provides them.

insert into branches (code,name) values ('B1','[ფილიალი 1]') on conflict (code) do nothing;
insert into branches (code,name) values ('B2','[ფილიალი 2]') on conflict (code) do nothing;
insert into branches (code,name) values ('B3','[ფილიალი 3]') on conflict (code) do nothing;
insert into branches (code,name) values ('B4','[ფილიალი 4]') on conflict (code) do nothing;
insert into branches (code,name) values ('B5','[ფილიალი 5]') on conflict (code) do nothing;
insert into branches (code,name) values ('B6','[ფილიალი 6]') on conflict (code) do nothing;

insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000100','ბურგერები',0) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000101','კომბო',1) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000102','ვრეპები და როლები',2) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000103','ბოულები',3) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000104','გარნირები',4) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000105','სოუსები',5) on conflict (id) do nothing;
insert into categories (id,name_ka,sort_order) values ('00000000-0000-0000-0000-000000000106','სასმელები',6) on conflict (id) do nothing;

insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000200','00000000-0000-0000-0000-000000000100','Double Smashed','სპეც სოუსი, ნატურალური საქონლის ხორცი 2 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი',1746,2495,'menu/01-double-smashed.jpg',0) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000100','The Monster','სპეც სოუსი, ნატურალური საქონლის ხორცი 3 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი',2289,3270,'menu/02-the-monster.jpg',1) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000100','Gochits Burger','სპეც სოუსი, ნატურალური საქონლის ხორცი, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი',1379,1970,'menu/04-gochits-burger.jpg',2) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000100','Giant Burger','სპეც სოუსი, ნატურალური საქონლის ხორცი 5 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი',3493,4990,'menu/05-giant-burger.jpg',3) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000100','Jalapeno Triple','სპეც სოუსი, ნატურალური საქონლის ხორცი 3 ფენა, ყველი ჩედარი ორმაგი, აისბერგი, ბეკონი, ჰალაპენიო, ხახვი, პომიდორი',2499,3570,'menu/06-jalapeno-triple.jpg',4) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000205','00000000-0000-0000-0000-000000000100','Double Chicken Burger','ქათმის ფილე, სუნელები, ბოსტნეული, მჟავე კიტრი, სპეც სოუსი',1470,2100,'menu/10-double-chicken-burger.jpg',5) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000206','00000000-0000-0000-0000-000000000100','Double Bacon Cheesburger','საქონლის ხორცი 200გრ, ჩედარი 4 ფენა, ბეკონი 2ცალი, მაიონეზი, სპეც სოუსი',1883,2690,'menu/12-double-bacon-cheesburger.jpg',6) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000207','00000000-0000-0000-0000-000000000100','BBQ','სპეც სოუსი, ბარბექიუს სოუსი, ნატურალური საქონლის ხორცი 2 ფენა შერეული მოხრაკულ ბეკონში, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი',2709,3870,'menu/07-bbq.jpg',7) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000208','00000000-0000-0000-0000-000000000100','Chicken Burger','ქათმის ფილე, სუნელები, ბოსტნეული, მჟავე კიტრი, სპეც სოუსი',1400,2000,'menu/09-chicken-burger.jpg',8) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000209','00000000-0000-0000-0000-000000000100','Mexican Hot','ტკბილი მდოგვი, სპეც სოუსი, ჰალაპენიო, ტობასკო, ნატურალური საქონლის ხორცი 2 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი',2289,3270,'menu/08-mexican-hot.jpg',9) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000210','00000000-0000-0000-0000-000000000100','Chicken Burger Spicy','ქათმის ფილე, სუნელები, ბოსტნეული, ჰალაპენიო, ცხარე სპეცსოუსი',1400,2000,'menu/11-chicken-burger-spicy.jpg',10) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000211','00000000-0000-0000-0000-000000000100','Pipipow Double Burger','ბურგერის პური, აისბერგი, პომიდორი, ნატურალური საქონლის ხორცი, ჩედარი, მჟავე კიტრი, ბეკონი, სპეც სოუსი, ბარბექიუ სოუსი, კეტჩუპი, მდოგვი',2800,4000,'menu/13-pipipow-double-burger.jpg',11) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000212','00000000-0000-0000-0000-000000000101','Double Smashed Combo','სპეც სოუსი, ნატურალური საქონლის ხორცი 2 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი, ფრი და სასმელი',3390,null,'menu/15-double-smashed-combo.jpg',12) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000213','00000000-0000-0000-0000-000000000101','Gochits Burger Combo','სპეც სოუსი, ნატურალური საქონლის ხორცი, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი, ფრი და სასმელი',2790,null,'menu/14-gochits-burger-combo.jpg',13) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000214','00000000-0000-0000-0000-000000000101','Chicken Burger Combo','ქათმის ფილე, სუნელები, ბოსტნეული, მჟავე კიტრი, სპეც სოუსი',2500,null,'menu/16-chicken-burger-combo.jpg',14) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000215','00000000-0000-0000-0000-000000000101','Double Chicken Burger Combo','ქათმის ფილე, სუნელები, ბოსტნეული, მჟავე კიტრი, სპეც სოუსი',2800,null,'menu/17-double-chicken-burger-combo.jpg',15) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000216','00000000-0000-0000-0000-000000000101','The Monster Combo','სპეც სოუსი, ნატურალური საქონლის ხორცი 3 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი და კარტოფილი ფრი + სასმელი',4090,null,'menu/18-the-monster-combo.jpg',16) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000217','00000000-0000-0000-0000-000000000101','Giant Burger Combo','სპეც სოუსი, ნატურალური საქონლის ხორცი 5 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი და კარტოფილი ფრი, სასმელი',5590,null,'menu/05-giant-burger.jpg',17) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000218','00000000-0000-0000-0000-000000000101','BBQ Double Combo','სპეც სოუსი, ბარბექიუს სოუსი, ნატურალური საქონლის ხორცი 2 ფენა შერეული მოხრაკულ ბეკონში, ყველი ჩედარი, აისბერგი, ხახვი, ბეკონი, კიტრის მარინადი, პომიდორი და კარტოფილი ფრი, სასმელი',4990,null,'menu/19-bbq-double-combo.jpg',18) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000219','00000000-0000-0000-0000-000000000101','Mexican Hot Combo','ტკბილი მდოგვი, სპეც სოუსი, ჰალაპენიო, ტობასკო, ნატურალური საქონლის ხორცი 2 ფენა, ყველი ჩედარი, აისბერგი, ხახვი, კიტრის მარინადი, პომიდორი და კარტოფილი ფრი, სასმელი',3990,null,'menu/20-mexican-hot-combo.jpg',19) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000220','00000000-0000-0000-0000-000000000101','Jalapeno Triple Combo','სპეც სოუსი, ნატურალური საქონლის ხორცი 3 ფენა, ყველი ჩედარი ორმაგი, აისბერგი, ჰალაპენიო, ხახვი, კიტრი და კარტოფილი, პომიდორი, ფრი, სასმელი',4390,null,'menu/21-jalapeno-triple-combo.jpg',20) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000221','00000000-0000-0000-0000-000000000101','Pipipow Double Burger Combo','ბურგერის პური, აისბერგი, პომიდორი, ნატურალური საქონლის ხორცი, ჩედარი, მჟავე კიტრი, ბეკონი, სპეც სოუსი, ბარბექიუ სოუსი, კეტჩუპი, მდოგვი',3590,null,null,21) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000222','00000000-0000-0000-0000-000000000102','ქათმის როლი','ქათმის ფილე, სუნელები, ბოსტნეული, მჟავე კიტრი, სპეც სოუსი',1850,null,null,22) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000223','00000000-0000-0000-0000-000000000102','ქათმის ცხარე როლი','ქათმის ფილე, სუნელები, ბოსტნეული, ჰალაპენიო, ცხარე სპეცსოუსი',1850,null,null,23) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000224','00000000-0000-0000-0000-000000000102','საქონლის ვრეპი','საქონლის ფარში, ყველი, ბოსტნეული, სპეც სოუსი, ბარბექიუ სოუსი, მჟავე კიტრი',1500,null,null,24) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000225','00000000-0000-0000-0000-000000000102','საქონლის ვრეპი ყველის სოუსით','საქონლის ფარში, ყველი, ბოსტნეული, სპეც სოუსი, ბარბექიუ სოუსი, მჟავე კიტრი, ყველის სოუსი',1500,null,null,25) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000226','00000000-0000-0000-0000-000000000102','ქათმის ვრეპი','ქათმის ფილე, ყველი, ბოსტნეული, სპეც სოუსი',2100,null,null,26) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000227','00000000-0000-0000-0000-000000000102','ქათმის ვრეპი ცხარე','ქათმის ფილე, ყველი, ბოსტნეული, ცხარე სპეც სოუსი',2100,null,null,27) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000228','00000000-0000-0000-0000-000000000103','ქათმის ბოული','ფრი, ქათმის ფილე, სპეც სოუსი',1750,null,null,28) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000229','00000000-0000-0000-0000-000000000103','ქათმის ფრეშ ბოული','ქათმის ფილე, სპეც სოუსი, აისბერგი, პომიდორი, მჟავე კიტრი',1450,null,null,29) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000230','00000000-0000-0000-0000-000000000104','კარტოფილი ფრი დიდი 350გრ.',null,850,null,'menu/03-350.jpg',30) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000231','00000000-0000-0000-0000-000000000104','კარტოფილი ფრი პატარა 200გრ.',null,650,null,'menu/03-350.jpg',31) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000232','00000000-0000-0000-0000-000000000104','კარტოფილი ფრი მდნარი ყველით და ჰალაპენიოთი',null,1650,null,null,32) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000233','00000000-0000-0000-0000-000000000105','ყველის ცხელი სოუსი 60გრ',null,700,null,null,33) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000234','00000000-0000-0000-0000-000000000105','მაიონეზი 30გრ',null,300,null,null,34) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000235','00000000-0000-0000-0000-000000000105','ჰალაპენიო 30გრ',null,350,null,null,35) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000236','00000000-0000-0000-0000-000000000105','კეტჩუპი 30გრ',null,300,null,null,36) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000237','00000000-0000-0000-0000-000000000105','BBQ სოუსი 30გრ',null,300,null,null,37) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000238','00000000-0000-0000-0000-000000000105','სპეც სოუსი 30გრ',null,300,null,null,38) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000239','00000000-0000-0000-0000-000000000105','სპეც სოუსი ცხარე 30გრ',null,300,null,null,39) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000240','00000000-0000-0000-0000-000000000106','კოკა-კოლა 0.33 ლ',null,400,null,null,40) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000241','00000000-0000-0000-0000-000000000106','კოკა-კოლა ზერო 0.33 ლ',null,400,null,null,41) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000242','00000000-0000-0000-0000-000000000106','ფანტა 0.33 ლ',null,400,null,null,42) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000243','00000000-0000-0000-0000-000000000106','სპრაიტი 0.33 ლ',null,400,null,null,43) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000244','00000000-0000-0000-0000-000000000106','Burn',null,450,null,null,44) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000245','00000000-0000-0000-0000-000000000106','კოკა-კოლა 0.5 ლ',null,400,null,null,45) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000246','00000000-0000-0000-0000-000000000106','კოკა-კოლა ზერო 0.5 ლ',null,350,null,null,46) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000247','00000000-0000-0000-0000-000000000106','ფანტა 0.5 ლ',null,400,null,null,47) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000248','00000000-0000-0000-0000-000000000106','სპრაიტი 0.5 ლ',null,400,null,null,48) on conflict (id) do nothing;
insert into products (id,category_id,name,description_ka,price_tetri,old_price_tetri,image_path,sort_order) values ('00000000-0000-0000-0000-000000000249','00000000-0000-0000-0000-000000000106','მთის წყალი 0.5 ლ',null,300,null,null,49) on conflict (id) do nothing;

-- every product available in every branch by default
insert into branch_products (branch_id,product_id) select b.id,p.id from branches b cross join products p on conflict do nothing;
