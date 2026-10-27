-- Fix #24: "Sample available" was never enforced. The button showed and the insert
-- went through for fabrics whose supplier had turned samples off. The item policy
-- only checked that the buyer owned the request; it now also requires the product
-- to belong to the request's supplier and to have samples switched on.
drop policy if exists sample_request_items_buyer_insert on public.sample_request_items;
create policy sample_request_items_buyer_insert on public.sample_request_items
  for insert to authenticated with check (
    public.can_access_sample_request(sample_request_id)
    and exists (
      select 1
      from public.products p
      join public.sample_requests s on s.id = sample_request_id
      where p.id = product_id
        and p.supplier_id = s.supplier_id
        and p.sample_available = true
        and p.status = 'published'
    )
  );

-- Fix #26: nothing ever wrote to recent_views, so the buyer dashboard panel stayed
-- empty. The unique index is partial (WHERE user_id IS NOT NULL), which PostgREST's
-- upsert cannot target, so the upsert lives here. Signed-in users only: the guest
-- session rows are not read anywhere.
create or replace function public.record_recent_view(p_product uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if not public.can_view_product(p_product) then
    return;
  end if;
  insert into public.recent_views (user_id, product_id, viewed_at)
  values (auth.uid(), p_product, now())
  on conflict (user_id, product_id) where user_id is not null
  do update set viewed_at = excluded.viewed_at;
end;
$$;

revoke execute on function public.record_recent_view(uuid) from public, anon;
grant  execute on function public.record_recent_view(uuid) to authenticated;
