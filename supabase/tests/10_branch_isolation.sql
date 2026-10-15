-- Plain-SQL assertions (no pgTAP needed). Run after migrations + seed via ./run-tests.sh. Any failure raises and aborts.
\set ON_ERROR_STOP on
\o /dev/null
begin;

-- fixtures: 2 users, 1 staff for B1, 1 super admin. Fake zone polygons exist ONLY in this test.
insert into auth.users (id, phone) values
  ('11111111-1111-1111-1111-111111111111', '+995500000001'),   -- customer
  ('22222222-2222-2222-2222-222222222222', '+995500000002'),   -- staff of B1
  ('33333333-3333-3333-3333-333333333333', '+995500000003'),   -- other customer
  ('44444444-4444-4444-4444-444444444444', '+995500000004');   -- super admin
update profiles set role = 'restaurant_staff' where id = '22222222-2222-2222-2222-222222222222';
update profiles set role = 'super_admin' where id = '44444444-4444-4444-4444-444444444444';

create temp table t as select
  (select id from branches where code = 'B1') as b1,
  (select id from branches where code = 'B2') as b2,
  (select id from branches where code = 'B3') as b3;
grant select on t to authenticated, anon;

insert into staff_branches select '22222222-2222-2222-2222-222222222222', b1 from t;

-- B1 zone: square around (44.80..44.82, 41.70..41.72) lng/lat ; B2 zone overlaps it; B3 zone elsewhere
insert into delivery_zones (branch_id, name, area, fee_tetri, min_order_tetri) select b1, 'z1', st_geogfromtext('POLYGON((44.80 41.70,44.82 41.70,44.82 41.72,44.80 41.72,44.80 41.70))'), 300, 1000 from t;
insert into delivery_zones (branch_id, name, area, fee_tetri) select b2, 'z2', st_geogfromtext('POLYGON((44.81 41.70,44.83 41.70,44.83 41.72,44.81 41.72,44.81 41.70))'), 400 from t;
insert into delivery_zones (branch_id, name, area, fee_tetri) select b3, 'z3', st_geogfromtext('POLYGON((45.10 41.90,45.12 41.90,45.12 41.92,45.10 41.92,45.10 41.90))'), 500 from t;
update branches set accepts_orders = true where code in ('B1', 'B2');   -- B3 stays closed
update branches set cod_enabled = true where code = 'B1';

create or replace function pg_temp.as_user(u text) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claim.sub', u, true); end $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as
$$ begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;

-- 1. resolve_branches: overlap returns both B1 and B2; outside returns nothing; closed branch cannot order
set local role authenticated;
select pg_temp.assert((select count(*) from resolve_branches(41.71, 44.815)) = 2, 'overlap returns 2 branches');
select pg_temp.assert((select count(*) from resolve_branches(41.71, 44.805)) = 1, 'only B1 zone covers west part');
select pg_temp.assert((select count(*) from resolve_branches(10, 10)) = 0, 'outside every zone returns nothing');
select pg_temp.assert((select can_order from resolve_branches(41.91, 45.11)) = false, 'closed branch B3 cannot order');

-- 2. customer creates an order; server computes totals
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into addresses (id, user_id, street, location) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'test', st_geogfromtext('POINT(44.805 41.71)')),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'far', st_geogfromtext('POINT(10 10)')),
  ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'overlap', st_geogfromtext('POINT(44.815 41.71)'));
reset role; set local role authenticated; select pg_temp.as_user('11111111-1111-1111-1111-111111111111');

create temp table res (id uuid); grant all on res to authenticated;
insert into res select create_order((select b1 from t), 'aaaaaaaa-0000-0000-0000-000000000001',
  '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1},{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'cash');
select pg_temp.assert((select subtotal_tetri from orders where id = (select id from res)) = 2 * 1746, 'subtotal from DB price, duplicate lines merged');
select pg_temp.assert((select delivery_fee_tetri from orders where id = (select id from res)) = 300, 'fee from zone');
select pg_temp.assert((select total_tetri from orders where id = (select id from res)) = 2 * 1746 + 300, 'total');
select pg_temp.assert((select number from orders where id = (select id from res)) = 'B1-000001', 'branch-prefixed number');
select pg_temp.assert((select status from orders where id = (select id from res)) = 'placed', 'cash order is placed');

-- 3. rejections
do $$ declare m text; begin
  begin perform create_order((select b1 from t), 'aaaaaaaa-0000-0000-0000-000000000002', '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'cash'); m := 'no error';
  exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'outside_zone', 'outside zone rejected, got ' || m);
  begin perform create_order((select b3 from t), 'aaaaaaaa-0000-0000-0000-000000000001', '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'cash'); m := 'no error';
  exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'branch_unavailable', 'closed branch rejected, got ' || m);
  begin perform create_order((select b2 from t), 'aaaaaaaa-0000-0000-0000-000000000004', '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'cash'); m := 'no error';
  exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'cash_not_allowed', 'cash blocked where cod disabled, got ' || m);
  begin perform create_order((select b1 from t), 'aaaaaaaa-0000-0000-0000-000000000001', '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":0}]'::jsonb, 'cash'); m := 'no error';
  exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'product_unavailable' or m = 'bad_quantity', 'quantity 0 rejected, got ' || m);
  begin perform create_order((select b1 from t), 'aaaaaaaa-0000-0000-0000-000000000001', '[{"product_id":"00000000-0000-0000-0000-000000000230","quantity":1}]'::jsonb, 'cash'); m := 'no error';
  exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'below_minimum', 'below minimum rejected, got ' || m);
end $$;

-- 4. isolation: other customer sees no orders; customers cannot write orders directly
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.assert((select count(*) from orders) = 0, 'other customer sees no orders');
do $$ declare m text; begin
  begin insert into orders (number, customer_id, branch_id, zone_id, status, payment_method, address_snapshot, delivery_point, subtotal_tetri, delivery_fee_tetri, total_tetri)
    select 'X', '33333333-3333-3333-3333-333333333333', b1, (select id from delivery_zones limit 1), 'placed', 'cash', '{}', st_geogfromtext('POINT(1 1)'), 0, 0, 0 from t; m := 'no error';
  exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m <> 'no error', 'direct order insert blocked');
end $$;

-- 5. staff of B1 sees the B1 order, cannot see/modify other branches, cannot change prices
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.assert((select count(*) from orders) = 1, 'B1 staff sees the B1 order');
select transition_order((select id from res), 'accepted');
select pg_temp.assert((select status from orders where id = (select id from res)) = 'accepted', 'staff accepted');
do $$ declare m text; begin
  begin perform transition_order((select id from res), 'delivered'); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m like 'invalid_transition%', 'skipping states rejected, got ' || m);
  begin update branch_products set price_override_tetri = 1 where branch_id = (select b1 from t); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'price_change_forbidden', 'staff cannot change price, got ' || m);
end $$;
update branch_products set is_available = false where branch_id = (select b1 from t) and product_id = '00000000-0000-0000-0000-000000000200';
select pg_temp.assert((select count(*) from branch_products where branch_id = (select b1 from t) and not is_available) = 1, 'staff toggles availability in own branch');
update branch_products set is_available = false where branch_id = (select b2 from t);
select pg_temp.assert((select count(*) from branch_products where branch_id = (select b2 from t) and not is_available) = 0, 'staff cannot change another branch (0 rows)');

-- 6. staff of B1 cannot transition an order of B2 (create one as super admin path is skipped: use direct role reset)
reset role;
insert into addresses (id, user_id, street, location) values ('aaaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'b2', st_geogfromtext('POINT(44.825 41.71)'));
update branches set cod_enabled = true where code = 'B2';
set local role authenticated; select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
insert into res select create_order((select b2 from t), 'aaaaaaaa-0000-0000-0000-000000000003', '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'cash');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.assert((select count(*) from orders) = 1, 'B1 staff still sees only B1 orders');
do $$ declare m text; begin
  begin perform transition_order((select id from res order by ctid desc limit 1), 'accepted'); m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'forbidden', 'B1 staff cannot touch B2 order, got ' || m);
end $$;

-- 7. users cannot escalate their own role
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$ declare m text; begin
  begin update profiles set role = 'super_admin' where id = '11111111-1111-1111-1111-111111111111'; m := 'no error'; exception when others then m := sqlerrm; end;
  perform pg_temp.assert(m = 'forbidden_field', 'role escalation blocked, got ' || m);
end $$;

reset role;
rollback;
\o
\echo ALL BRANCH ISOLATION CHECKS PASSED
