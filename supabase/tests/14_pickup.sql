-- Migration 0013: self pick-up orders.
\set ON_ERROR_STOP on
\o /dev/null
begin;
insert into auth.users (id, phone, email) values
  ('d1d1d1d1-0000-0000-0000-000000000001', '+995500000031', null),
  ('d2d2d2d2-0000-0000-0000-000000000002', '+995500000032', 'staff-p@example.com'),
  ('d3d3d3d3-0000-0000-0000-000000000003', '+995500000033', 'courier-p@example.com');
update branches set accepts_orders = true where code = 'B1';
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as
$$ begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
create or replace function pg_temp.err(sql text) returns text language plpgsql as
$$ begin execute sql; return 'no error'; exception when others then return sqlerrm; end $$;
create temp table ctx (k text primary key, oid uuid); grant all on ctx to authenticated;
insert into staff_branches select 'd2d2d2d2-0000-0000-0000-000000000002', id from branches where code = 'B1';
update profiles set role = 'restaurant_staff' where id = 'd2d2d2d2-0000-0000-0000-000000000002';
update profiles set role = 'courier' where id = 'd3d3d3d3-0000-0000-0000-000000000003';
insert into couriers (user_id, status) values ('d3d3d3d3-0000-0000-0000-000000000003', 'approved') on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1d1d1d1-0000-0000-0000-000000000001', true);
-- no address and no zone needed
insert into ctx select 'o', create_pickup_order((select id from branches where code='B1'), '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":2}]'::jsonb, 'cash', 'x', null, 15);
select pg_temp.assert((select fulfillment = 'pickup' and delivery_fee_tetri = 0 and zone_id is null and status = 'placed' and total_tetri = subtotal_tetri from orders where id = (select oid from ctx where k='o')), 'pickup order shape');

-- switching pick-up off blocks new pickup orders
reset role; update branches set pickup_enabled = false where code = 'B1';
set local role authenticated; select set_config('request.jwt.claim.sub', 'd1d1d1d1-0000-0000-0000-000000000001', true);
select pg_temp.assert(pg_temp.err($q$select create_pickup_order((select id from branches where code='B1'), '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'cash')$q$) = 'pickup_disabled', 'pickup disabled');
reset role; update branches set pickup_enabled = true, pickup_discount_percent = 10 where code = 'B1';
set local role authenticated; select set_config('request.jwt.claim.sub', 'd1d1d1d1-0000-0000-0000-000000000001', true);
insert into ctx select 'o2', create_pickup_order((select id from branches where code='B1'), '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'cash');
select pg_temp.assert((select discount_tetri = subtotal_tetri / 10 and total_tetri = subtotal_tetri - discount_tetri from orders where id = (select oid from ctx where k='o2')), 'pickup discount');

-- restaurant: accept -> ready -> handed over
select set_config('request.jwt.claim.sub', 'd2d2d2d2-0000-0000-0000-000000000002', true);
select transition_order((select oid from ctx where k='o'), 'accepted');
select pg_temp.assert(pg_temp.err(format($q$select transition_order(%L, 'delivered')$q$, (select oid from ctx where k='o'))) like 'invalid_transition%', 'cannot hand over before ready');
select transition_order((select oid from ctx where k='o'), 'ready_for_pickup');

-- couriers never see it and cannot take it
select set_config('request.jwt.claim.sub', 'd3d3d3d3-0000-0000-0000-000000000003', true);
select pg_temp.assert((select count(*) from courier_feed()) = 0, 'courier feed has no pickup orders');
select pg_temp.assert(pg_temp.err(format($q$select courier_accept(%L)$q$, (select oid from ctx where k='o'))) = 'not_available', 'courier cannot accept pickup');

select set_config('request.jwt.claim.sub', 'd2d2d2d2-0000-0000-0000-000000000002', true);
select transition_order((select oid from ctx where k='o'), 'delivered');
select pg_temp.assert((select status = 'delivered' from orders where id = (select oid from ctx where k='o')), 'handed over');
-- a delivery-style hand-over to a courier is still impossible for staff
select transition_order((select oid from ctx where k='o2'), 'accepted');
select transition_order((select oid from ctx where k='o2'), 'ready_for_pickup');
select pg_temp.assert(pg_temp.err(format($q$select transition_order(%L, 'out_for_delivery')$q$, (select oid from ctx where k='o2'))) like 'invalid_transition%', 'no out_for_delivery for staff');
select pg_temp.assert((select pickup_enabled from staff_my_branches() limit 1), 'staff_my_branches has pickup flag');
select staff_set_pickup((select id from branches where code='B1'), false);
select pg_temp.assert((select not pickup_enabled from staff_my_branches() limit 1), 'staff switch');
rollback;
\o
\echo 14_pickup OK
