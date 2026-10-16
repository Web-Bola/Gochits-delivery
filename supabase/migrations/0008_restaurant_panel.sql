-- Restaurant (branch) panel support + staff management for the admin panel.

-- 1. Admin: list / add / remove branch staff. The person must already exist (Authentication -> Users -> Add user).
create or replace function admin_staff() returns table (user_id uuid, email text, full_name text, branch_id uuid, branch_name text)
language plpgsql security definer set search_path = public as
$$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  return query
    select sb.user_id, u.email::text, p.full_name, sb.branch_id, b.name
    from staff_branches sb join auth.users u on u.id = sb.user_id join profiles p on p.id = sb.user_id join branches b on b.id = sb.branch_id
    order by b.name, u.email;
end
$$;

create or replace function admin_add_staff(p_email text, p_branch uuid) returns void
language plpgsql security definer set search_path = public as
$$
declare v_user uuid; v_role user_role;
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then raise exception 'user_not_found'; end if;
  select role into v_role from profiles where id = v_user;
  if v_role = 'super_admin' then raise exception 'already_admin'; end if;
  if not exists (select 1 from branches where id = p_branch) then raise exception 'branch_not_found'; end if;
  update profiles set role = 'restaurant_staff' where id = v_user and role in ('customer', 'restaurant_staff');
  insert into staff_branches (user_id, branch_id) values (v_user, p_branch) on conflict do nothing;
end
$$;

create or replace function admin_remove_staff(p_user uuid, p_branch uuid) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if not is_super_admin() then raise exception 'forbidden'; end if;
  delete from staff_branches where user_id = p_user and branch_id = p_branch;
  if not exists (select 1 from staff_branches where user_id = p_user) then
    update profiles set role = 'customer' where id = p_user and role = 'restaurant_staff';
  end if;
end
$$;

-- 2. Staff: contact details of customers on this branch's recent orders (profiles are not readable by staff otherwise).
create or replace function staff_contacts(p_branch uuid) returns table (order_id uuid, phone text, full_name text)
language plpgsql security definer set search_path = public as
$$
begin
  if not is_branch_staff(p_branch) then raise exception 'forbidden'; end if;
  return query
    select o.id, p.phone, p.full_name from orders o join profiles p on p.id = o.customer_id
    where o.branch_id = p_branch and o.created_at > now() - interval '2 days';
end
$$;

-- 3. Staff: pause / resume taking orders for their own branch.
create or replace function staff_set_accepting(p_branch uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as
$$
begin
  if not is_branch_staff(p_branch) then raise exception 'forbidden'; end if;
  update branches set accepts_orders = coalesce(p_on, false) where id = p_branch;
end
$$;

-- 4. Staff: their own branches (name + whether orders are being accepted), readable even while a branch is paused.
create or replace function staff_my_branches() returns table (id uuid, name text, accepts_orders boolean)
language plpgsql security definer set search_path = public as
$$
begin
  return query
    select b.id, b.name, b.accepts_orders from branches b
    where b.is_active and (is_super_admin() or exists (select 1 from staff_branches sb where sb.user_id = auth.uid() and sb.branch_id = b.id and is_branch_staff(b.id)))
    order by b.code;
end
$$;

revoke all on function admin_staff, admin_add_staff, admin_remove_staff, staff_contacts, staff_set_accepting, staff_my_branches from public, anon;
grant execute on function admin_staff, admin_add_staff, admin_remove_staff, staff_contacts, staff_set_accepting, staff_my_branches to authenticated;
