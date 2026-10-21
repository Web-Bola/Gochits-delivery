-- Migration 0014: merchants (marketplace layer).
\set ON_ERROR_STOP on
\o /dev/null
begin;
insert into auth.users (id, phone, email) values
  ('e1e1e1e1-0000-0000-0000-000000000001', '+995500000041', null),
  ('e2e2e2e2-0000-0000-0000-000000000002', '+995500000042', 'admin-m@example.com');
update profiles set role = 'super_admin' where id = 'e2e2e2e2-0000-0000-0000-000000000002';
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as
$$ begin if not coalesce(cond, false) then raise exception 'ASSERT FAILED: %', msg; end if; end $$;
create or replace function pg_temp.err(sql text) returns text language plpgsql as
$$ begin execute sql; return 'no error'; exception when others then return sqlerrm; end $$;
create temp table ctx (k text primary key, oid uuid); grant all on ctx to authenticated;

-- existing data was migrated into Gochit's
select pg_temp.assert((select count(*) = 0 from branches where merchant_id <> '00000000-0000-0000-0000-0000000000a1'), 'all branches under gochits');
select pg_temp.assert((select count(*) = 0 from categories where merchant_id <> '00000000-0000-0000-0000-0000000000a1'), 'all categories under gochits');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e1e1e1e1-0000-0000-0000-000000000001', true);
select pg_temp.assert((select count(*) = 1 from list_merchants() where slug = 'gochits' and branch_count >= 1), 'customer sees gochits');
select pg_temp.assert(pg_temp.err($q$select admin_save_merchant(null,'kafe-1','Kafe','cafe',null,null,null,true,1)$q$) = 'forbidden', 'customer cannot add merchant');

-- admin creates a second business with a branch and a menu
select set_config('request.jwt.claim.sub', 'e2e2e2e2-0000-0000-0000-000000000002', true);
insert into ctx select 'm', admin_save_merchant(null, 'kafe-1', 'Kafe Pirveli', 'cafe', 'ყავა და ნამცხვრები', null, null, true, 1);
insert into ctx select 'b', admin_save_branch(null, 'K1', 'Kafe Pirveli - ვაკე', 'ვაკე', null, 41.71, 44.78, true, true, true, true, 0, (select oid from ctx where k = 'm'));
select pg_temp.assert((select merchant_id = (select oid from ctx where k = 'm') from branches where id = (select oid from ctx where k = 'b')), 'branch under new merchant');
select pg_temp.assert(pg_temp.err($q$select admin_save_merchant(null,'kafe-1','Dup','cafe',null,null,null,true,1)$q$) like '%duplicate%', 'slug unique');

reset role;
insert into categories (id, name_ka, merchant_id) values ('00000000-0000-0000-0000-0000000005a1', 'ყავა', (select oid from ctx where k = 'm'));
insert into products (id, category_id, name, price_tetri) values ('00000000-0000-0000-0000-0000000005b1', '00000000-0000-0000-0000-0000000005a1', 'ესპრესო', 400);
-- product of merchant 2 cannot be offered by a Gochit's branch, and vice versa
select pg_temp.assert(pg_temp.err($q$insert into branch_products (branch_id, product_id) select id, '00000000-0000-0000-0000-0000000005b1' from branches where code = 'B1'$q$) = 'merchant_mismatch', 'cross merchant product blocked');
select pg_temp.assert(pg_temp.err($q$insert into branch_products (branch_id, product_id) values ((select oid from ctx where k = 'b'), '00000000-0000-0000-0000-000000000200')$q$) = 'merchant_mismatch', 'gochits product blocked at kafe');
insert into branch_products (branch_id, product_id) values ((select oid from ctx where k = 'b'), '00000000-0000-0000-0000-0000000005b1');

-- new branches of a merchant get the merchant menu automatically
set local role authenticated; select set_config('request.jwt.claim.sub', 'e2e2e2e2-0000-0000-0000-000000000002', true);
insert into ctx select 'b2', admin_save_branch(null, 'K2', 'Kafe 2', null, null, null, null, true, false, false, true, 0, (select oid from ctx where k = 'm'));
select pg_temp.assert((select count(*) = 1 from branch_products where branch_id = (select oid from ctx where k = 'b2')), 'menu seeded for new branch');
-- cannot move a branch with products to another merchant
select pg_temp.assert(pg_temp.err(format($q$select admin_save_branch(%L,'K2','Kafe 2',null,null,null,null,true,false,false,true,0,'00000000-0000-0000-0000-0000000000a1')$q$, (select oid from ctx where k = 'b2'))) = 'merchant_has_products', 'move blocked');

-- list functions carry the merchant; inactive merchant disappears
select pg_temp.assert((select count(*) = 2 from list_merchants()), 'two merchants listed');
select pg_temp.assert((select count(*) = 1 from list_branches() where merchant_id = (select oid from ctx where k = 'm') and name = 'Kafe Pirveli - ვაკე'), 'list_branches merchant');
reset role;
update merchants set is_active = false where id = (select oid from ctx where k = 'm');
select pg_temp.assert((select count(*) = 0 from list_branches() where merchant_id = (select oid from ctx where k = 'm')), 'inactive merchant hidden');
select pg_temp.assert((select count(*) = 1 from list_merchants()), 'inactive merchant not listed');
rollback;
\o
select 'merchants ok';
