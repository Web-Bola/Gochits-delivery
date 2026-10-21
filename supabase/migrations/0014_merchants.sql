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
