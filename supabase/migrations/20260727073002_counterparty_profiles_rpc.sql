-- Pre-existing hole surfaced by WS3: `profiles_select_own_or_admin` means a
-- supplier cannot read the buyer's profiles row (nor their buyers row), so every
-- supplier-facing screen that renders a buyer name has been showing a blank or a
-- fallback -- including InquirySummary on the supplier inquiry detail page. A
-- supplier could not see who had inquired or who they were invoicing.
--
-- Fixed with a narrow SECURITY DEFINER accessor rather than a new profiles SELECT
-- policy: RLS is row-level, so a policy wide enough to expose the name would also
-- expose phone_numbers / whatsapp_numbers to any counterparty. This returns three
-- columns and only for people you actually transact with.
create or replace function public.get_counterparty_profiles()
returns table(id uuid, full_name text, company_name text)
language sql stable security definer set search_path = '' as $$
  select distinct p.id, p.full_name, p.company_name
  from public.profiles p
  where p.id in (
    select i.buyer_id          from public.inquiries i       where i.supplier_id = auth.uid()
    union select i.supplier_id from public.inquiries i       where i.buyer_id    = auth.uid()
    union select s.buyer_id    from public.sample_requests s where s.supplier_id = auth.uid()
    union select s.supplier_id from public.sample_requests s where s.buyer_id    = auth.uid()
    union select v.buyer_id    from public.invoices v        where v.supplier_id = auth.uid()
    union select v.supplier_id from public.invoices v        where v.buyer_id    = auth.uid()
  );
$$;

revoke execute on function public.get_counterparty_profiles() from public, anon;
grant  execute on function public.get_counterparty_profiles() to authenticated;
