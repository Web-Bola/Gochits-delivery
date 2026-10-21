-- DEMO ONLY: 5 fictional restaurants with menus so the redesigned app can be reviewed with photos.
-- Run manually, as ONE script, in the Supabase SQL editor (test project). NOT a migration; never run on a live production catalogue.
-- Restaurants start with accepts_orders = false (visible, but no real order can be placed). To try ordering in the test project, run the last UPDATE.
-- Prices are sample values (price_source stays 'unapproved' until an owner confirms real prices).

do $$
declare
  m record; b uuid; c uuid; p uuid; i int;
  center geography := st_setsrid(st_makepoint(44.8271, 41.7151), 4326)::geography;
begin
  for m in select * from (values
    ('bbbbbbbb-0000-0000-0000-000000000001'::uuid,'burger-club','Burger Club','ბურგერები · ამერიკული','BC',1),
    ('bbbbbbbb-0000-0000-0000-000000000002'::uuid,'shavi-lomi','Shavi Lomi','ქართული · გრილი','SL',2),
    ('bbbbbbbb-0000-0000-0000-000000000003'::uuid,'sushi-corner','Sushi Corner','სუში · აზიური','SC',3),
    ('bbbbbbbb-0000-0000-0000-000000000004'::uuid,'pizza-loro','Pizza L''Oro','პიცა · იტალიური','PL',4),
    ('bbbbbbbb-0000-0000-0000-000000000005'::uuid,'khinkali-house','ხინკლის სახლი','ქართული · ტრადიციული','KH',5)
  ) as t(id,slug,name,descr,code,so)
  loop
    insert into merchants (id, slug, name, kind, description, sort_order) values (m.id, m.slug, m.name, 'restaurant', m.descr, m.so) on conflict (id) do nothing;
    b := ('dddddddd-0000-0000-0000-00000000000' || m.so)::uuid;
    insert into branches (id, code, name, address, merchant_id, location, is_active, accepts_orders, pickup_enabled)
      values (b, 'D' || m.code, m.name, 'თბილისი (დემო)', m.id, center, true, false, true) on conflict (id) do nothing;
    for i in 0..6 loop
      insert into branch_hours (branch_id, weekday, opens, closes) values (b, i, '10:00', '23:30') on conflict do nothing;
    end loop;
    insert into delivery_zones (branch_id, name, area, fee_tetri, min_order_tetri, extra_minutes)
      select b, 'თბილისი (დემო)', st_setsrid(st_makepolygon(st_makeline(array[
        st_makepoint(44.70,41.62), st_makepoint(44.95,41.62), st_makepoint(44.95,41.82), st_makepoint(44.70,41.82), st_makepoint(44.70,41.62)])),4326)::geography, 290, 0, 5
      where not exists (select 1 from delivery_zones z where z.branch_id = b);
  end loop;
end $$;

-- menus: (merchant slug, category, product, description, price in tetri, image key)
create temp table demo_menu(slug text, cat text, name text, descr text, price int, img text);
insert into demo_menu values
  ('burger-club','ბურგერები','კლასიკური ბურგერი','საქონლის ხორცი, ჩედარი, სალათი, პომიდორი',2590,'demo/burger-classic.jpg'),
  ('burger-club','ბურგერები','ბეკონ ბურგერი','საქონლის ხორცი, ბეკონი, ჩედარი, ხახვი',2490,'demo/burger-cheese.jpg'),
  ('shavi-lomi','ცხელი კერძები','გრილზე შემწვარი ხორცი','ხორცი მწვანილითა და ჩერი პომიდორით',3290,'demo/steak.jpg'),
  ('shavi-lomi','სალათები','გრილზე ქათმის სალათა','ქათმის ფილე, ჩერი პომიდორი, მწვანე სალათა',2890,'demo/salad.jpg'),
  ('shavi-lomi','სალათები','მწვანე სალათა','ბოსტნეული და მწვანილი',1690,'demo/salad2.jpg'),
  ('sushi-corner','სუში','სუშის სეტი','მრავალფეროვანი როლები ორაგულით',2990,'demo/sushi.jpg'),
  ('pizza-loro','პიცა','მარგარიტა','ყველი, ტომატის სოუსი, ბაზილიკი',2490,'demo/pizza.jpg'),
  ('khinkali-house','ცომეული','აჭარული ხაჭაპური','ყველი, კვერცხი, კარაქი',1890,'demo/khachapuri.jpg');

insert into categories (name_ka, sort_order, merchant_id)
select x.cat, 0, mm.id from (select distinct slug, cat from demo_menu) x join merchants mm on mm.slug = x.slug
 where not exists (select 1 from categories c where c.merchant_id = mm.id and c.name_ka = x.cat);

insert into products (category_id, name, description_ka, price_tetri, image_path, price_source)
select (select c.id from categories c where c.merchant_id = mm.id and c.name_ka = d.cat limit 1), d.name, d.descr, d.price, d.img, 'unapproved'
  from demo_menu d join merchants mm on mm.slug = d.slug
 where not exists (select 1 from products p join categories c on c.id = p.category_id where c.merchant_id = mm.id and p.name = d.name);

insert into branch_products (branch_id, product_id, is_available)
select b.id, p.id, true
  from products p join categories c on c.id = p.category_id join branches b on b.merchant_id = c.merchant_id and b.code like 'D%'
 where p.image_path like 'demo/%'
on conflict do nothing;

-- OPTIONAL, test project only: let the demo restaurants accept orders.
-- update branches set accepts_orders = true where code like 'D%';
