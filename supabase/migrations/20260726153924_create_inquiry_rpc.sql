-- Atomic inquiry creation. CartPage previously did three sequential client
-- round-trips per supplier group (insert inquiry -> insert items -> delete cart
-- rows), so a mid-flight failure left an orphan empty inquiry with the cart rows
-- still present -- and buyers have no DELETE policy on inquiries, so the client
-- cannot compensate. One function call is one transaction, which fixes that.
--
-- SECURITY INVOKER on purpose: every existing RLS policy still applies exactly as
-- before, so this adds no privilege surface. It also closes a hole the cart shape
-- was hiding -- lines are verified to belong to p_supplier_id and to be visible to
-- the caller, so a client cannot attach another supplier's products to an inquiry.
create or replace function public.create_inquiry(
  p_supplier_id uuid,
  p_lines jsonb,
  p_cart_item_ids uuid[] default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inquiry_id uuid;
  v_valid int;
begin
  if p_lines is null or jsonb_array_length(p_lines) = 0 then
    raise exception 'an inquiry needs at least one line' using errcode = '22023';
  end if;

  select count(*) into v_valid
  from jsonb_to_recordset(p_lines)
       as l(product_id uuid, quantity_meters numeric, notes text)
  join public.products p on p.id = l.product_id
  where p.supplier_id = p_supplier_id
    and public.can_view_product(p.id);

  if v_valid <> jsonb_array_length(p_lines) then
    raise exception 'inquiry lines must reference visible products belonging to supplier %',
      p_supplier_id using errcode = '42501';
  end if;

  insert into public.inquiries (buyer_id, supplier_id, status)
  values (auth.uid(), p_supplier_id, 'open')
  returning id into v_inquiry_id;

  insert into public.inquiry_items (inquiry_id, product_id, quantity_meters, notes)
  select v_inquiry_id, l.product_id, l.quantity_meters, l.notes
  from jsonb_to_recordset(p_lines)
       as l(product_id uuid, quantity_meters numeric, notes text);

  if p_cart_item_ids is not null then
    delete from public.cart_items
     where id = any(p_cart_item_ids) and buyer_id = auth.uid();
  end if;

  return v_inquiry_id;
end;
$$;

-- NOTE: this PUBLIC revoke is incomplete on its own -- Supabase's default
-- privileges grant EXECUTE explicitly to anon as well. Completed in
-- 20260726154158_revoke_trigger_fn_execute_from_api_roles.sql.
revoke execute on function public.create_inquiry(uuid, jsonb, uuid[]) from public;
grant  execute on function public.create_inquiry(uuid, jsonb, uuid[]) to authenticated;
