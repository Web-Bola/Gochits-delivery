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
