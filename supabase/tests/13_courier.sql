-- Migration 0009: courier hand-over.
\set ON_ERROR_STOP on
\o /dev/null
begin;
insert into auth.users (id, phone, email) values
  ('c1c1c1c1-0000-0000-0000-000000000001', '+995500000021', null),
  ('c2c2c2c2-0000-0000-0000-000000000002', '+995500000022', 'courier@example.com'),
  ('c3c3c3c3-0000-0000-0000-000000000003', '+995500000023', 'staff@example.com');
update branches set accepts_orders = true, cod_enabled = true where code = 'B1';
insert into delivery_zones (branch_id, name, area, fee_tetri) select id, 'z', st_geogfromtext('POLYGON((44.80 41.70,44.82 41.70,44.82 41.72,44.80 41.72,44.80 41.70))'), 300 from branches where code = 'B1';
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as
$$ begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
create or replace function pg_temp.err(sql text) returns text language plpgsql as
$$ begin execute sql; return 'no error'; exception when others then return sqlerrm; end $$;
create temp table ctx (k text primary key, oid uuid); grant all on ctx to authenticated;
insert into staff_branches select 'c3c3c3c3-0000-0000-0000-000000000003', id from branches where code = 'B1';
update profiles set role = 'restaurant_staff' where id = 'c3c3c3c3-0000-0000-0000-000000000003';
update profiles set role = 'super_admin' where id = 'c2c2c2c2-0000-0000-0000-000000000002';

-- admin makes a courier
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2c2c2c2-0000-0000-0000-000000000002', true);
select pg_temp.assert(pg_temp.err($q$select admin_add_courier('nobody@example.com')$q$) = 'user_not_found', 'unknown email');
reset role;
insert into auth.users (id, email) values ('c4c4c4c4-0000-0000-0000-000000000004', 'rider@example.com');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'c2c2c2c2-0000-0000-0000-000000000002', true);
select admin_add_courier('rider@example.com');
select pg_temp.assert((select count(*) from admin_couriers()) = 1, 'courier listed');

-- customer places an order, staff takes it to out_for_delivery
select set_config('request.jwt.claim.sub', 'c1c1c1c1-0000-0000-0000-000000000001', true);
insert into addresses (id, user_id, street, location) values ('cccccccc-0000-0000-0000-000000000099', 'c1c1c1c1-0000-0000-0000-000000000001', 'x', st_geogfromtext('POINT(44.81 41.71)'));
insert into ctx select 'o', create_order((select id from branches where code='B1'), 'cccccccc-0000-0000-0000-000000000099', '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'cash');
select pg_temp.assert(pg_temp.err($q$select courier_deliveries()$q$) = 'forbidden', 'customer cannot list deliveries');
select set_config('request.jwt.claim.sub', 'c3c3c3c3-0000-0000-0000-000000000003', true);
select transition_order((select oid from ctx where k='o'), 'accepted');
select transition_order((select oid from ctx where k='o'), 'preparing');
select transition_order((select oid from ctx where k='o'), 'ready_for_pickup');
select transition_order((select oid from ctx where k='o'), 'out_for_delivery');
select pg_temp.assert(pg_temp.err(format($q$select transition_order(%L, 'delivered')$q$, (select oid from ctx where k='o'))) like 'invalid_transition%', 'staff cannot mark delivered');
select pg_temp.assert(pg_temp.err(format($q$select courier_mark_delivered(%L)$q$, (select oid from ctx where k='o'))) = 'forbidden', 'staff is not a courier');

-- courier sees it and delivers
select set_config('request.jwt.claim.sub', 'c4c4c4c4-0000-0000-0000-000000000004', true);
select pg_temp.assert((select count(*) from courier_deliveries()) = 1, 'courier sees the order');
select courier_mark_delivered((select oid from ctx where k='o'));
select pg_temp.assert((select count(*) from courier_deliveries()) = 0, 'gone after delivery');
reset role;
select pg_temp.assert((select status = 'delivered' and payment_status = 'paid' and courier_id = 'c4c4c4c4-0000-0000-0000-000000000004' from orders where id = (select oid from ctx where k='o')), 'delivered, cash paid, courier recorded');
rollback;
\o
\echo courier OK
