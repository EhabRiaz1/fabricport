-- C2: Bound the public product-images bucket (previously unlimited size, any mime).
update storage.buckets
set file_size_limit = 10485760,  -- 10 MB
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif']
where id = 'product-images';

-- C3: Close the forgeable analytics write. The supplier_page_views INSERT policy was
-- WITH CHECK (true) for anon — anyone could POST arbitrary view rows for any supplier.
-- Route writes through a SECURITY DEFINER RPC that stamps viewed_at and viewer_id
-- server-side and dedupes within 30 minutes, then revoke the direct INSERT grant.
create or replace function public.record_supplier_view(
  p_supplier uuid,
  p_product uuid default null,
  p_referrer text default null,
  p_session text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_supplier is null then
    return;
  end if;

  if exists (
    select 1 from public.supplier_page_views v
    where v.supplier_id = p_supplier
      and v.product_id is not distinct from p_product
      and v.session_id is not distinct from p_session
      and v.viewed_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  insert into public.supplier_page_views
    (supplier_id, product_id, viewer_id, session_id, referrer, viewed_at)
  values
    (p_supplier, p_product, auth.uid(), p_session, p_referrer, now());
end;
$$;

grant execute on function public.record_supplier_view(uuid, uuid, text, text) to anon, authenticated;

drop policy if exists supplier_page_views_insert on public.supplier_page_views;
revoke insert on public.supplier_page_views from anon, authenticated;
