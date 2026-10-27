-- Admin panel fixes (Oct 2026 fix list, Stream E).
--
--   * guard_profile_admin_columns: 20261027100000 redefined this function and
--     dropped the overdue_flagged / overdue_flagged_at checks that
--     20260727103954 had added. Restored here, with is_demo kept.
--   * #45 demo accounts are excluded from the admin reports, overdue list and the
--     dashboard counters (new get_admin_dashboard_counts RPC).
--   * #22 supplier response rate uses ONE definition everywhere (same as
--     get_supplier_response_stats in 20261027140000): responded = the inquiry
--     has at least one message from the supplier, window = last 90 days,
--     demo accounts excluded.
--   * #41 attributes: slug `type` is shown publicly as "Availability", so it is
--     named that way in admin too and becomes a dropdown. Elongation gets a %
--     unit. (Slugs are unchanged; spec_facets keys still work.)
--   * app_settings: fx_override key (fix #9 manual override).
--   * Outstanding / overdue amounts use invoices.total_pkr (subtotal + tax +
--     freight, added by 20261027150000), falling back to subtotal_pkr.

-- ---------------------------------------------------------------- guard
create or replace function public.guard_profile_admin_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (auth.role() = 'service_role') or public.is_admin() then return new; end if;
  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.is_demo is distinct from old.is_demo
     or new.overdue_flagged is distinct from old.overdue_flagged
     or new.overdue_flagged_at is distinct from old.overdue_flagged_at then
    raise exception 'not permitted to modify admin-controlled profile columns'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_profile_admin_columns() from public, anon, authenticated;

-- ---------------------------------------------------------------- helpers
-- True when either party of an inquiry is a demo account. Used by every
-- admin aggregate so the exclusion rule lives in one place.
create or replace function public.inquiry_is_demo(p_buyer uuid, p_supplier uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id in (p_buyer, p_supplier) and p.is_demo
  );
$$;
revoke execute on function public.inquiry_is_demo(uuid, uuid) from public, anon;
grant  execute on function public.inquiry_is_demo(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- overdue
create or replace function public.get_overdue_buyers()
returns table(
  buyer_id uuid, full_name text, company_name text,
  overdue_flagged boolean, status text,
  overdue_invoices bigint, overdue_amount_pkr numeric, oldest_due_date date
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select p.id, p.full_name, p.company_name, p.overdue_flagged, p.status,
         count(i.id),
         coalesce(sum(coalesce(i.total_pkr, i.subtotal_pkr, 0) - i.amount_paid_pkr), 0),
         min(i.due_date)
  from public.invoices i
  join public.profiles p on p.id = i.buyer_id
  where i.status in ('sent','acknowledged')
    and i.payment_status <> 'paid'
    and i.due_date is not null
    and i.due_date < current_date
    and not p.is_demo
    and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)
  group by p.id, p.full_name, p.company_name, p.overdue_flagged, p.status;
end;
$$;

-- ---------------------------------------------------------------- reports
create or replace function public.get_admin_report_stats(p_weeks int default 8)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
  v_since timestamptz := now() - (p_weeks || ' weeks')::interval;
  v_resp_since timestamptz := now() - interval '90 days';
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'inquiries_per_week', (
      select coalesce(jsonb_agg(jsonb_build_object('week', wk, 'count', c) order by wk), '[]'::jsonb)
      from (select date_trunc('week', i.created_at)::date wk, count(*) c
              from public.inquiries i
             where i.created_at >= v_since
               and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)
             group by 1) x),
    -- ONE definition of "responded", shared with the supplier dashboard/analytics:
    -- the supplier has posted at least one message; window = last 90 days.
    'supplier_response_rate', (
      select case when count(*) = 0 then null
        else round(100.0 * count(*) filter (where answered) / count(*), 1) end
      from (select i.id, exists(select 1 from public.messages m
              where m.inquiry_id = i.id and m.sender_id = i.supplier_id) answered
              from public.inquiries i
             where i.created_at >= v_resp_since
               and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)) y),
    'median_first_response_hours', (
      select round((percentile_cont(0.5) within group (
        order by extract(epoch from (m.first_at - i.created_at)) / 3600.0))::numeric, 1)
      from public.inquiries i
      join lateral (select min(created_at) first_at from public.messages
                     where inquiry_id = i.id and sender_id = i.supplier_id) m on true
      where m.first_at is not null
        and i.created_at >= v_resp_since
        and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)),
    'overdue_amount_pkr', (
      select coalesce(sum(coalesce(i.total_pkr, i.subtotal_pkr, 0) - i.amount_paid_pkr), 0) from public.invoices i
      where status in ('sent','acknowledged') and payment_status <> 'paid'
        and due_date is not null and due_date < current_date
        and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)),
    'outstanding_amount_pkr', (
      select coalesce(sum(coalesce(i.total_pkr, i.subtotal_pkr, 0) - i.amount_paid_pkr), 0) from public.invoices i
      where status in ('sent','acknowledged') and payment_status <> 'paid'
        and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)),
    'collected_amount_pkr', (
      select coalesce(sum(amount_paid_pkr),0) from public.invoices i
      where not public.inquiry_is_demo(i.buyer_id, i.supplier_id)),
    'top_fabrics', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select jsonb_build_object('title', p.title, 'slug', p.slug, 'inquiries', count(*)) t
        from public.inquiry_items ii join public.inquiries i on i.id = ii.inquiry_id
        join public.products p on p.id = ii.product_id
        where i.created_at >= v_since
          and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)
        group by p.title, p.slug
        order by count(*) desc limit 5) z),
    'top_suppliers', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select jsonb_build_object('brand_name', s.brand_name, 'inquiries', count(*)) t
        from public.inquiries i join public.suppliers s on s.id = i.supplier_id
        where i.created_at >= v_since
          and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)
        group by s.brand_name
        order by count(*) desc limit 5) z),
    'funnel', jsonb_build_object(
      'product_views', (
        select count(*) from public.supplier_page_views v
        left join public.profiles vp on vp.id = v.viewer_id
        where v.viewed_at >= v_since
          and not coalesce(vp.is_demo, false) and coalesce(vp.role, '') <> 'admin'),
      'unique_view_sessions', (
        select count(distinct v.session_id) from public.supplier_page_views v
        left join public.profiles vp on vp.id = v.viewer_id
        where v.viewed_at >= v_since
          and not coalesce(vp.is_demo, false) and coalesce(vp.role, '') <> 'admin'),
      'inquiries', (
        select count(*) from public.inquiries i
        where i.created_at >= v_since
          and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)),
      'sample_requests', (
        select count(*) from public.sample_requests sr
        where sr.created_at >= v_since
          and not public.inquiry_is_demo(sr.buyer_id, sr.supplier_id)),
      'supplier_responses', (
        select count(distinct i.id) from public.inquiries i
        join public.messages m on m.inquiry_id = i.id and m.sender_id = i.supplier_id
        where i.created_at >= v_since
          and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)),
      'whatsapp_notifications_sent', (
        select count(*) from public.whatsapp_log w
        left join public.profiles wp on wp.id = w.user_id
        where w.sent_at >= v_since and w.status = 'sent'
          and not coalesce(wp.is_demo, false))),
    'buyer_conversion', jsonb_build_object(
      'buyers_total', (
        select count(*) from public.buyers b
        join public.profiles p on p.id = b.id where not p.is_demo),
      'buyers_with_inquiry', (
        select count(distinct i.buyer_id) from public.inquiries i
        join public.profiles p on p.id = i.buyer_id
        where not p.is_demo and not public.inquiry_is_demo(i.buyer_id, i.supplier_id))),
    'pending_price_approvals', (select count(*) from public.products
      where price_approved = false and price_min_pkr is not null)
  ) into v;
  return v;
end;
$$;

revoke execute on function public.get_overdue_buyers() from public, anon;
grant  execute on function public.get_overdue_buyers() to authenticated;
revoke execute on function public.get_admin_report_stats(int) from public, anon;
grant  execute on function public.get_admin_report_stats(int) to authenticated;

-- ---------------------------------------------------------------- dashboard
-- The admin dashboard used to run six head/count queries directly, none of
-- which could exclude demo accounts across both parties of an inquiry.
create or replace function public.get_admin_dashboard_counts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
  v_month_start timestamptz := date_trunc('month', now());
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'total_products', (
      select count(*) from public.products p
      join public.profiles sp on sp.id = p.supplier_id
      where not sp.is_demo),
    'active_suppliers', (
      select count(*) from public.suppliers s
      join public.profiles p on p.id = s.id
      where p.status = 'active' and not p.is_demo),
    'registered_buyers', (
      select count(*) from public.buyers b
      join public.profiles p on p.id = b.id where not p.is_demo),
    'inquiries_this_month', (
      select count(*) from public.inquiries i
      where i.created_at >= v_month_start
        and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)),
    'pending_listing_requests', (
      select count(*) from public.listing_requests
      where status in ('submitted', 'fabric_received', 'scanning')),
    'pending_price_approvals', (
      select count(*) from public.products
      where price_approved = false and price_min_pkr is not null),
    'inquiry_weeks', (
      select coalesce(jsonb_agg(jsonb_build_object('week', wk, 'count', c) order by wk), '[]'::jsonb)
      from (select date_trunc('week', i.created_at)::date wk, count(*) c
              from public.inquiries i
             where i.created_at >= now() - interval '8 weeks'
               and not public.inquiry_is_demo(i.buyer_id, i.supplier_id)
             group by 1) x),
    'demo_accounts', (select count(*) from public.profiles where is_demo)
  ) into v;
  return v;
end;
$$;
revoke execute on function public.get_admin_dashboard_counts() from public, anon;
grant  execute on function public.get_admin_dashboard_counts() to authenticated;

-- ---------------------------------------------------------------- attributes
update public.fabric_attributes
   set name = 'Availability',
       type = 'select',
       options = case
         when options is null or jsonb_typeof(options) <> 'array' or jsonb_array_length(options) = 0
           then '["Stock", "Running", "Development"]'::jsonb
         else options end
 where slug = 'type';

update public.fabric_attributes
   set unit = '%'
 where slug = 'elongation' and (unit is null or btrim(unit) = '');

-- ---------------------------------------------------------------- settings
-- app_settings is created by 20261027150000 (Stream D). Guarded here only so
-- this migration is safe to run in isolation.
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('fx_override', 'null'::jsonb)
on conflict (key) do nothing;
