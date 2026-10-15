-- Demo functions must be inert unless demo_mode = 'true'. Run via run-tests.sh.
\set ON_ERROR_STOP on
\o /dev/null
begin;
insert into auth.users (id, phone) values ('55555555-5555-5555-5555-555555555555', '+995500000005'), ('66666666-6666-6666-6666-666666666666', '+995500000006');
update branches set accepts_orders = true, cod_enabled = true where code = 'B1';
insert into delivery_zones (branch_id, name, area, fee_tetri) select id, 'z', st_geogfromtext('POLYGON((44.80 41.70,44.82 41.70,44.82 41.72,44.80 41.72,44.80 41.70))'), 300 from branches where code = 'B1';
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as
$$ begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
create temp table ctx (oid uuid); grant all on ctx to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
select pg_temp.assert((select cod_enabled from resolve_branches(41.71, 44.81)), 'resolve_branches exposes cod_enabled');
insert into addresses (id, user_id, street, location) values ('bbbbbbbb-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'x', st_geogfromtext('POINT(44.81 41.71)'));
insert into ctx select create_order((select id from branches where code = 'B1'), 'bbbbbbbb-0000-0000-0000-000000000001', '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'card');
select pg_temp.assert((select status from orders where id = (select oid from ctx)) = 'pending_payment', 'card order waits for payment');

do $$ declare m text; begin
  begin perform demo_pay_order((select oid from ctx), true); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'demo_disabled', 'demo_pay_order blocked when demo off, got ' || m);
  begin perform demo_advance_order((select oid from ctx)); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'demo_disabled', 'demo_advance_order blocked when demo off, got ' || m);
end $$;

reset role;
update app_settings set value = 'true' where key = 'demo_mode';
set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);
do $$ declare m text; begin
  begin perform demo_pay_order((select oid from ctx), true); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'order_not_found', 'another customer cannot pay my order, got ' || m);
end $$;
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
select demo_pay_order((select oid from ctx), true);
select pg_temp.assert((select status from orders where id = (select oid from ctx)) = 'placed', 'paid -> placed');
select pg_temp.assert((select payment_status from orders where id = (select oid from ctx)) = 'paid', 'payment_status paid');
select demo_advance_order((select oid from ctx));
select pg_temp.assert((select status from orders where id = (select oid from ctx)) = 'accepted', 'advance -> accepted');
select demo_advance_order((select oid from ctx)); select demo_advance_order((select oid from ctx)); select demo_advance_order((select oid from ctx)); select demo_advance_order((select oid from ctx));
select pg_temp.assert((select status from orders where id = (select oid from ctx)) = 'delivered', 'reaches delivered');
do $$ declare m text; begin
  begin perform demo_advance_order((select oid from ctx)); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'invalid_state', 'cannot advance past delivered, got ' || m);
end $$;
reset role;
rollback;
\o
\echo ALL DEMO MODE CHECKS PASSED
