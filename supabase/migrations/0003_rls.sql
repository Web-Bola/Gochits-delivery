-- Deny by default: enable RLS everywhere, then allow only what each role needs.
alter table profiles enable row level security;
alter table branches enable row level security;
alter table branch_hours enable row level security;
alter table delivery_zones enable row level security;
alter table staff_branches enable row level security;
alter table couriers enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table branch_products enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_events enable row level security;

-- profiles: own row. Role/phone cannot be changed by the user (trigger below).
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_super_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create or replace function protect_profile_fields() returns trigger language plpgsql as
$$ begin
  -- auth.uid() is null for service role / SQL editor / migrations: those are trusted backend contexts
  if auth.uid() is not null and not is_super_admin() and (new.role is distinct from old.role or new.phone is distinct from old.phone) then
    raise exception 'forbidden_field';
  end if;
  return new;
end $$;
create trigger profiles_protect before update on profiles for each row execute function protect_profile_fields();

-- Public catalogue reads (active only). Writes: super admin only.
create policy branches_read on branches for select using (is_active or is_super_admin());
create policy branches_admin on branches for all using (is_super_admin()) with check (is_super_admin());
create policy hours_read on branch_hours for select using (true);
create policy hours_admin on branch_hours for all using (is_super_admin()) with check (is_super_admin());
create policy zones_read on delivery_zones for select using (is_active or is_super_admin());
create policy zones_admin on delivery_zones for all using (is_super_admin()) with check (is_super_admin());
create policy categories_read on categories for select using (true);
create policy categories_admin on categories for all using (is_super_admin()) with check (is_super_admin());
create policy products_read on products for select using (is_active or is_super_admin());
create policy products_admin on products for all using (is_super_admin()) with check (is_super_admin());

-- Branch availability: anyone reads; branch staff may toggle availability of their own branch only.
create policy bp_read on branch_products for select using (true);
create policy bp_staff_update on branch_products for update
  using (is_branch_staff(branch_id)) with check (is_branch_staff(branch_id));
create policy bp_admin on branch_products for all using (is_super_admin()) with check (is_super_admin());
-- Staff must not change price overrides: enforced by trigger.
create or replace function protect_branch_product_price() returns trigger language plpgsql as
$$ begin
  if auth.uid() is not null and not is_super_admin() and new.price_override_tetri is distinct from old.price_override_tetri then
    raise exception 'price_change_forbidden';
  end if;
  return new;
end $$;
create trigger bp_protect_price before update on branch_products for each row execute function protect_branch_product_price();

create policy staff_branches_read on staff_branches for select using (user_id = auth.uid() or is_super_admin());
create policy staff_branches_admin on staff_branches for all using (is_super_admin()) with check (is_super_admin());
create policy couriers_read on couriers for select
  using (user_id = auth.uid() or is_super_admin() or (home_branch_id is not null and is_branch_staff(home_branch_id)));
create policy couriers_admin on couriers for all using (is_super_admin()) with check (is_super_admin());

-- addresses: owner only
create policy addresses_owner on addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- orders: customer sees own; staff see their branch; courier sees assigned. No direct writes (use functions).
create policy orders_customer_read on orders for select using (customer_id = auth.uid());
create policy orders_staff_read on orders for select using (is_branch_staff(branch_id));
create policy orders_courier_read on orders for select using (courier_id = auth.uid());
create policy order_items_read on order_items for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_id = auth.uid() or is_branch_staff(o.branch_id) or o.courier_id = auth.uid())));
create policy order_events_read on order_events for select using (
  exists (select 1 from orders o where o.id = order_id
          and (o.customer_id = auth.uid() or is_branch_staff(o.branch_id) or o.courier_id = auth.uid())));

-- Tables have no INSERT/UPDATE policy for orders/items/events: only SECURITY DEFINER functions write them.
revoke insert, update, delete on orders, order_items, order_events from anon, authenticated;

-- New auth user -> customer profile
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as
$$ begin
  insert into profiles (id, phone) values (new.id, new.phone) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
