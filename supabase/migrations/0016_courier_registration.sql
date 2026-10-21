-- Courier self-registration (ZYRO Partner): a person signs up, applies, an admin approves.
-- Until approved they are NOT a courier (profiles.role stays 'customer'), so they see no orders.

alter table couriers
  add column if not exists personal_id text,
  add column if not exists city text,
  add column if not exists vehicle text check (vehicle in ('scooter', 'bike', 'car', 'foot')),
  add column if not exists plate text,
  add column if not exists online boolean not null default true,
  add column if not exists applied_at timestamptz not null default now();

create or replace function courier_apply(p_full_name text, p_phone text, p_personal_id text, p_city text, p_vehicle text, p_plate text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  if length(trim(coalesce(p_full_name, ''))) < 3 then raise exception 'invalid_name'; end if;
  if p_vehicle not in ('scooter', 'bike', 'car', 'foot') then raise exception 'invalid_vehicle'; end if;
  select status into v_status from couriers where user_id = auth.uid();
  if v_status = 'approved' then raise exception 'already_courier'; end if;
  if v_status = 'suspended' then raise exception 'suspended'; end if;
  update profiles set full_name = trim(p_full_name), phone = coalesce(nullif(trim(p_phone), ''), phone) where id = auth.uid();
  insert into couriers (user_id, status, personal_id, city, vehicle, plate, applied_at)
  values (auth.uid(), 'pending', nullif(trim(p_personal_id), ''), nullif(trim(p_city), ''), p_vehicle, nullif(trim(p_plate), ''), now())
  on conflict (user_id) do update
    set personal_id = excluded.personal_id, city = excluded.city, vehicle = excluded.vehicle, plate = excluded.plate, applied_at = now();
end $$;

-- What the applicant sees about their own application.
create or replace function courier_my_status()
returns table (status text, full_name text, vehicle text, online boolean)
language sql stable security definer set search_path = public as $$
  select c.status::text, p.full_name::text, c.vehicle, c.online
  from couriers c join profiles p on p.id = c.user_id where c.user_id = auth.uid();
$$;

create or replace function courier_set_online(p_online boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_courier() then raise exception 'forbidden'; end if;
  update couriers set online = p_online where user_id = auth.uid();
end $$;

-- Admin: approve / reject / suspend an application.
create or replace function admin_set_courier_status(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  if p_status not in ('approved', 'pending', 'suspended') then raise exception 'invalid_status'; end if;
  update couriers set status = p_status where user_id = p_user;
  if not found then raise exception 'not_found'; end if;
  update profiles set role = case when p_status = 'approved' then 'courier'::user_role else 'customer'::user_role end where id = p_user and role <> 'super_admin';
end $$;

create or replace function admin_courier_applications()
returns table (user_id uuid, full_name text, phone text, city text, vehicle text, plate text, status text, applied_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query select c.user_id, p.full_name::text, p.phone::text, c.city, c.vehicle, c.plate, c.status::text, c.applied_at
    from couriers c join profiles p on p.id = c.user_id order by (c.status = 'pending') desc, c.applied_at desc;
end $$;

revoke all on function courier_apply, courier_my_status, courier_set_online, admin_set_courier_status, admin_courier_applications from public;
grant execute on function courier_apply, courier_my_status, courier_set_online to authenticated;
grant execute on function admin_set_courier_status, admin_courier_applications to authenticated;
