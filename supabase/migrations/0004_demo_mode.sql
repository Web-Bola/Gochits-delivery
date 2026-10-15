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
