-- The customer may see the name and phone of the courier who is delivering THEIR order (only while it is out for delivery).
create or replace function order_courier(p_order_id uuid)
returns table (full_name text, phone text)
language sql stable security definer set search_path = public as $$
  select p.full_name, p.phone
  from orders o join profiles p on p.id = o.courier_id
  where o.id = p_order_id and o.customer_id = auth.uid() and o.status = 'out_for_delivery';
$$;
revoke all on function order_courier from public;
grant execute on function order_courier to authenticated;
