-- Migration 0006: item notes, quantity guard, promo, ratings, opening hours, favorites, account deletion.
\set ON_ERROR_STOP on
\o /dev/null
begin;
insert into auth.users (id, phone) values
  ('77777777-7777-7777-7777-777777777777', '+995500000007'),
  ('88888888-8888-8888-8888-888888888888', '+995500000008');
update branches set accepts_orders = true, cod_enabled = true where code = 'B1';
insert into delivery_zones (branch_id, name, area, fee_tetri) select id, 'z', st_geogfromtext('POLYGON((44.80 41.70,44.82 41.70,44.82 41.72,44.80 41.72,44.80 41.70))'), 300 from branches where code = 'B1';
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as
$$ begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
create or replace function pg_temp.err(sql text) returns text language plpgsql as
$$ begin execute sql; return 'no error'; exception when others then return sqlerrm; end $$;
create temp table ctx (k text primary key, oid uuid); grant all on ctx to authenticated;

-- ---------- opening hours (explicit timestamps, Asia/Tbilisi = UTC+4) ----------
insert into branch_hours (branch_id, weekday, opens, closes) select id, 1, '10:00', '22:00' from branches where code = 'B1';
insert into branch_hours (branch_id, weekday, opens, closes) select id, 5, '18:00', '02:00' from branches where code = 'B1';
select pg_temp.assert(branch_is_open((select id from branches where code='B1'), '2026-10-19 12:00+04'), 'Monday noon open');
select pg_temp.assert(not branch_is_open((select id from branches where code='B1'), '2026-10-19 23:00+04'), 'Monday 23:00 closed');
select pg_temp.assert(not branch_is_open((select id from branches where code='B1'), '2026-10-16 17:00+04'), 'Friday 17:00 closed');
select pg_temp.assert(branch_is_open((select id from branches where code='B1'), '2026-10-16 19:00+04'), 'Friday 19:00 open');
select pg_temp.assert(branch_is_open((select id from branches where code='B1'), '2026-10-17 01:00+04'), 'Saturday 01:00 open (Friday shift past midnight)');
select pg_temp.assert(not branch_is_open((select id from branches where code='B1'), '2026-10-17 03:00+04'), 'Saturday 03:00 closed');
select pg_temp.assert(not branch_is_open((select id from branches where code='B1'), '2026-10-20 12:00+04'), 'Tuesday has no row -> closed');
select pg_temp.assert(branch_is_open((select id from branches where code='B2'), '2026-10-20 12:00+04'), 'branch without hours rows is open');
-- always-closed hours (opens = closes): ordering must be refused and resolve_branches must say so
delete from branch_hours where branch_id = (select id from branches where code='B1');
insert into branch_hours (branch_id, weekday, opens, closes) select b.id, d, '00:00', '00:00' from branches b, generate_series(0,6) d where b.code = 'B1';

set local role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
insert into addresses (id, user_id, street, location) values ('cccccccc-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'x', st_geogfromtext('POINT(44.81 41.71)'));
select pg_temp.assert((select not can_order and not is_open from resolve_branches(41.71, 44.81)), 'closed branch: can_order false, is_open false');
select pg_temp.assert(pg_temp.err($q$select create_order((select id from branches where code='B1'), 'cccccccc-0000-0000-0000-000000000001', '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'card')$q$) = 'branch_closed', 'create_order refuses when closed');
reset role;
delete from branch_hours where branch_id = (select id from branches where code='B1');

set local role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
select pg_temp.assert((select can_order and is_open from resolve_branches(41.71, 44.81)), 'no hours rows -> open');

-- ---------- quantity guard ----------
select pg_temp.assert(pg_temp.err($q$select create_order((select id from branches where code='B1'), 'cccccccc-0000-0000-0000-000000000001', '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":-5},{"product_id":"00000000-0000-0000-0000-000000000200","quantity":6}]'::jsonb, 'cash')$q$) = 'bad_quantity', 'negative element cannot offset another');
select pg_temp.assert(pg_temp.err($q$select create_order((select id from branches where code='B1'), 'cccccccc-0000-0000-0000-000000000001', '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":"2"}]'::jsonb, 'cash')$q$) = 'bad_quantity', 'string quantity refused');

-- ---------- notes: same product, different notes = separate lines ----------
insert into ctx select 'o1', create_order((select id from branches where code='B1'), 'cccccccc-0000-0000-0000-000000000001',
  '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1,"note":"ამოღებულია: ხახვი"},{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1},{"product_id":"00000000-0000-0000-0000-000000000200","quantity":2,"note":"ამოღებულია: ხახვი"}]'::jsonb, 'cash');
select pg_temp.assert((select count(*) from order_items where order_id = (select oid from ctx where k='o1')) = 2, 'two lines: with note and without');
select pg_temp.assert((select quantity from order_items where order_id = (select oid from ctx where k='o1') and note is not null) = 3, 'same note aggregated');
select pg_temp.assert((select subtotal_tetri from orders where id = (select oid from ctx where k='o1')) = (select sum(unit_price_tetri*quantity) from order_items where order_id = (select oid from ctx where k='o1')), 'subtotal matches lines');

-- ---------- promo ----------
select pg_temp.assert(pg_temp.err($q$select apply_promo('DEMO', 5000)$q$) = 'promo_invalid', 'DEMO refused when demo mode is off');
select pg_temp.assert(pg_temp.err($q$select apply_promo('NOPE', 5000)$q$) = 'promo_invalid', 'unknown code refused');
select pg_temp.assert((select count(*) from promo_codes) = 0, 'clients cannot see promo_codes rows (RLS)');
reset role;
update app_settings set value = 'true' where key = 'demo_mode';
set local role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
select pg_temp.assert(apply_promo(' demo ', 5000) = 500, 'DEMO = 10% (case/space insensitive)');
reset role;
select pg_temp.assert((select used_count from promo_codes where code = 'DEMO') = 0, 'preview does not consume');
set local role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
insert into ctx select 'o2', create_order((select id from branches where code='B1'), 'cccccccc-0000-0000-0000-000000000001',
  '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":2}]'::jsonb, 'card', null, 'demo');
select pg_temp.assert((select discount_tetri from orders where id = (select oid from ctx where k='o2')) = (select subtotal_tetri/10 from orders where id = (select oid from ctx where k='o2')), 'order carries 10% discount');
select pg_temp.assert((select total_tetri from orders where id = (select oid from ctx where k='o2')) = (select subtotal_tetri - discount_tetri + delivery_fee_tetri from orders where id = (select oid from ctx where k='o2')), 'total = subtotal - discount + fee');
reset role;
select pg_temp.assert((select used_count from promo_codes where code = 'DEMO') = 1, 'create_order consumes the code');
update promo_codes set max_uses = 1 where code = 'DEMO';
set local role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
select pg_temp.assert(pg_temp.err($q$select apply_promo('DEMO', 5000)$q$) = 'promo_used_up', 'max_uses respected');

-- ---------- ratings ----------
select pg_temp.assert(pg_temp.err(format($q$select rate_order(%L, 5, 'ok')$q$, (select oid from ctx where k='o1'))) = 'invalid_state', 'cannot rate before delivery');
reset role;
update orders set status = 'delivered' where id = (select oid from ctx where k='o1');
set local role authenticated;
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
select pg_temp.assert(pg_temp.err(format($q$select rate_order(%L, 5, 'ok')$q$, (select oid from ctx where k='o1'))) = 'order_not_found', 'cannot rate someone else''s order');
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
select pg_temp.assert(pg_temp.err(format($q$select rate_order(%L, 6, 'x')$q$, (select oid from ctx where k='o1'))) = 'bad_rating', 'stars 1..5 only');
select rate_order((select oid from ctx where k='o1'), 4, '  yummy  ');
select rate_order((select oid from ctx where k='o1'), 5, '');
select pg_temp.assert((select stars from order_ratings where order_id = (select oid from ctx where k='o1')) = 5, 'rating can be updated');
select pg_temp.assert((select comment from order_ratings where order_id = (select oid from ctx where k='o1')) is null, 'empty comment stored as null');

-- ---------- favorites ----------
insert into favorites (user_id, product_id) values ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000200');
select pg_temp.assert((select count(*) from favorites) = 1, 'owner sees favorite');
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
select pg_temp.assert((select count(*) from favorites) = 0, 'other user sees none');
select pg_temp.assert(pg_temp.err($q$insert into favorites (user_id, product_id) values ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000200')$q$) like '%row-level security%', 'cannot write favorite for someone else');

-- ---------- address helpers ----------
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
do $$ declare a uuid; begin
  a := add_address('  რუსთაველი 1 ', ' 2 ', '3', '', null, 41.71, 44.81);
  perform pg_temp.assert((select street from my_addresses() where id = a) = 'რუსთაველი 1', 'street trimmed');
  perform pg_temp.assert((select lat from my_addresses() where id = a) = 41.71 and (select lng from my_addresses() where id = a) = 44.81, 'lat/lng round trip');
  perform pg_temp.assert((select apartment from my_addresses() where id = a) is null, 'empty field -> null');
  perform pg_temp.assert(pg_temp.err('select add_address(''ab'', null, null, null, null, 41, 44)') = 'bad_address', 'short street refused');
  perform pg_temp.assert(pg_temp.err('select add_address(''abc'', null, null, null, null, 91, 44)') = 'bad_address', 'lat range checked');
end $$;
select pg_temp.assert((select count(*) from my_addresses()) = 1, 'only own addresses listed');
select pg_temp.assert((select count(*) from list_branches()) = 6, 'six branches listed');
select pg_temp.assert((select bool_and(is_open) from list_branches()), 'no hours rows -> all open');

-- ---------- customer cancel ----------
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
insert into ctx select 'o3', create_order((select id from branches where code='B1'), 'cccccccc-0000-0000-0000-000000000001',
  '[{"product_id":"00000000-0000-0000-0000-000000000200","quantity":1}]'::jsonb, 'cash');
select set_config('request.jwt.claim.sub', '88888888-8888-8888-8888-888888888888', true);
select pg_temp.assert(pg_temp.err(format($q$select cancel_my_order(%L)$q$, (select oid from ctx where k='o3'))) = 'order_not_found', 'cannot cancel someone else''s order');
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
select cancel_my_order((select oid from ctx where k='o3'));
select pg_temp.assert((select status from orders where id = (select oid from ctx where k='o3')) = 'cancelled', 'unpaid placed order cancelled');
select pg_temp.assert(pg_temp.err(format($q$select cancel_my_order(%L)$q$, (select oid from ctx where k='o3'))) = 'cannot_cancel', 'cannot cancel twice');
select pg_temp.assert(pg_temp.err(format($q$select cancel_my_order(%L)$q$, (select oid from ctx where k='o1'))) = 'cannot_cancel', 'cannot cancel delivered order');

-- ---------- account deletion ----------
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
select pg_temp.assert(pg_temp.err($q$select delete_my_account()$q$) = 'active_order', 'active order blocks deletion');
reset role;
update orders set status = 'cancelled' where id = (select oid from ctx where k='o2');
set local role authenticated;
select set_config('request.jwt.claim.sub', '77777777-7777-7777-7777-777777777777', true);
select delete_my_account();
reset role;
select pg_temp.assert(not exists (select 1 from auth.users where id = '77777777-7777-7777-7777-777777777777'), 'auth user removed');
select pg_temp.assert(not exists (select 1 from addresses where user_id = '77777777-7777-7777-7777-777777777777'), 'addresses removed');
select pg_temp.assert(not exists (select 1 from favorites where user_id = '77777777-7777-7777-7777-777777777777'), 'favorites removed');
select pg_temp.assert((select count(*) from orders where id in (select oid from ctx)) = 3, 'orders kept for accounting');
select pg_temp.assert((select bool_and(customer_id is null and address_snapshot = '{"deleted": true}'::jsonb) from orders where id in (select oid from ctx)), 'orders anonymised');
rollback;
\o
\echo ALL CUSTOMER FEATURE CHECKS PASSED
