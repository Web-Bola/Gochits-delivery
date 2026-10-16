-- Admin panel support. Every function checks is_super_admin() itself; nothing here is reachable by customers.

-- 1. Delivery zones are saved as a circle (centre + radius) so no map provider is needed. The polygon is derived from it.
alter table delivery_zones add column if not exists center_lat double precision;
alter table delivery_zones add column if not exists center_lng double precision;
alter table delivery_zones add column if not exists radius_m integer check (radius_m is null or radius_m between 100 and 30000);

create or replace function admin_save_zone(
  p_id uuid, p_branch uuid, p_name text, p_lat double precision, p_lng double precision, p_radius_m integer,
  p_fee_tetri integer, p_min_order_tetri integer, p_free_from_tetri integer, p_extra_minutes integer, p_active boolean
) returns uuid language plpgsql security definer set search_path = public as
$$
declare v_area geography; v_id uuid;
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  if p_radius_m < 100 or p_radius_m > 30000 then raise exception 'bad_radius'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'bad_point'; end if;
  v_area := st_buffer(st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_m, 32)::geometry::geography;
  if p_id is null then
    insert into delivery_zones (branch_id, name, area, fee_tetri, min_order_tetri, free_from_tetri, extra_minutes, is_active, center_lat, center_lng, radius_m)
    values (p_branch, p_name, v_area, p_fee_tetri, coalesce(p_min_order_tetri, 0), p_free_from_tetri, coalesce(p_extra_minutes, 0), coalesce(p_active, true), p_lat, p_lng, p_radius_m)
    returning id into v_id;
  else
    update delivery_zones set branch_id = p_branch, name = p_name, area = v_area, fee_tetri = p_fee_tetri,
      min_order_tetri = coalesce(p_min_order_tetri, 0), free_from_tetri = p_free_from_tetri, extra_minutes = coalesce(p_extra_minutes, 0),
      is_active = coalesce(p_active, true), center_lat = p_lat, center_lng = p_lng, radius_m = p_radius_m
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'zone_not_found'; end if;
  end if;
  return v_id;
end
$$;

-- 2. Branches with coordinates (the table stores a geography point).
create or replace function admin_branches() returns table (
  id uuid, code text, name text, address text, phone text, lat double precision, lng double precision,
  is_active boolean, accepts_orders boolean, cod_enabled boolean
) language plpgsql security definer set search_path = public as
$$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query select b.id, b.code, b.name, b.address, b.phone, st_y(b.location::geometry), st_x(b.location::geometry),
    b.is_active, b.accepts_orders, b.cod_enabled from branches b order by b.code;
end
$$;

create or replace function admin_save_branch(
  p_id uuid, p_code text, p_name text, p_address text, p_phone text, p_lat double precision, p_lng double precision,
  p_is_active boolean, p_accepts_orders boolean, p_cod_enabled boolean
) returns uuid language plpgsql security definer set search_path = public as
$$
declare v_loc geography; v_id uuid;
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  v_loc := case when p_lat is null or p_lng is null then null else st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography end;
  if p_id is null then
    insert into branches (code, name, address, phone, location, is_active, accepts_orders, cod_enabled)
    values (upper(btrim(p_code)), p_name, nullif(btrim(p_address), ''), nullif(btrim(p_phone), ''), v_loc, coalesce(p_is_active, true), coalesce(p_accepts_orders, false), coalesce(p_cod_enabled, false))
    returning id into v_id;
  else
    update branches set name = p_name, address = nullif(btrim(p_address), ''), phone = nullif(btrim(p_phone), ''), location = v_loc,
      is_active = coalesce(p_is_active, true), accepts_orders = coalesce(p_accepts_orders, false), cod_enabled = coalesce(p_cod_enabled, false)
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'branch_not_found'; end if;
  end if;
  return v_id;
end
$$;

-- 3. Weekly hours: replace all 7 days of one branch at once. p_hours = [{weekday:0..6, opens:"10:00", closes:"23:00"}] (closed day = omitted).
create or replace function admin_save_hours(p_branch uuid, p_hours jsonb) returns void
language plpgsql security definer set search_path = public as
$$
declare h jsonb;
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  delete from branch_hours where branch_id = p_branch;
  for h in select * from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) loop
    insert into branch_hours (branch_id, weekday, opens, closes)
    values (p_branch, (h->>'weekday')::smallint, (h->>'opens')::time, (h->>'closes')::time);
  end loop;
end
$$;

-- 4. Promo codes: admins manage them directly (RLS limits it to super admins; customers still use the functions).
grant select, insert, update, delete on promo_codes to authenticated;

-- 5. Sales report by day and branch (cancelled/rejected/unpaid-card orders are excluded).
create or replace function admin_report(p_from date, p_to date) returns table (
  day date, branch_id uuid, branch_name text, orders bigint, revenue_tetri bigint, delivery_tetri bigint, discount_tetri bigint
) language plpgsql security definer set search_path = public as
$$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query
    select (o.created_at at time zone 'Asia/Tbilisi')::date, o.branch_id, b.name, count(*), sum(o.total_tetri)::bigint, sum(o.delivery_fee_tetri)::bigint, sum(o.discount_tetri)::bigint
    from orders o join branches b on b.id = o.branch_id
    where (o.created_at at time zone 'Asia/Tbilisi')::date between p_from and p_to
      and o.status in ('placed','accepted','preparing','ready_for_pickup','out_for_delivery','delivered')
    group by 1, 2, 3 order by 1 desc, 3;
end
$$;

revoke all on function admin_save_zone, admin_branches, admin_save_branch, admin_save_hours, admin_report from public, anon;
grant execute on function admin_save_zone, admin_branches, admin_save_branch, admin_save_hours, admin_report to authenticated;
