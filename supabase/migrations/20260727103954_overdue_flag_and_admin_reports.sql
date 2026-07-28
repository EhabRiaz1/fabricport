-- WS6: overdue flagging + the admin Reports data layer.

alter table public.profiles add column if not exists overdue_flagged boolean not null default false;
alter table public.profiles add column if not exists overdue_flagged_at timestamptz;

-- Extends the WS-Sec guard: without these two lines a flagged buyer could simply
-- PATCH their own flag off, since profiles_update_own_or_admin permits self-update.
create or replace function public.guard_profile_admin_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (auth.role() = 'service_role') or public.is_admin() then return new; end if;
  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.overdue_flagged is distinct from old.overdue_flagged
     or new.overdue_flagged_at is distinct from old.overdue_flagged_at then
    raise exception 'not permitted to modify admin-controlled profile columns'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- eng-C3: authorization is the FIRST statement and search_path is pinned.
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
         coalesce(sum(coalesce(i.subtotal_pkr,0) - i.amount_paid_pkr), 0),
         min(i.due_date)
  from public.invoices i
  join public.profiles p on p.id = i.buyer_id
  -- eng-H3: a draft has no due_date, so drafts can never surface as overdue.
  where i.status in ('sent','acknowledged')
    and i.payment_status <> 'paid'
    and i.due_date is not null
    and i.due_date < current_date
  group by p.id, p.full_name, p.company_name, p.overdue_flagged, p.status;
end;
$$;

-- Concrete report metrics, not a generic chart feed.
--
-- NOTE on the channel funnel: the plan called for "WhatsApp click-throughs" as a
-- funnel stage. There is no WhatsApp/external contact CTA anywhere in the public
-- UI, so there is nothing to click and nothing to measure; whatsapp_log only
-- records OUTBOUND notifications the send-notification function dispatched. That
-- is exposed here honestly as `whatsapp_notifications_sent` rather than dressed up
-- as a click-through metric that would always read zero.
create or replace function public.get_admin_report_stats(p_weeks int default 8)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb; v_since timestamptz := now() - (p_weeks || ' weeks')::interval;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'inquiries_per_week', (
      select coalesce(jsonb_agg(jsonb_build_object('week', wk, 'count', c) order by wk), '[]'::jsonb)
      from (select date_trunc('week', created_at)::date wk, count(*) c
              from public.inquiries where created_at >= v_since group by 1) x),
    'supplier_response_rate', (
      -- Answered = the SUPPLIER has posted at least once on that inquiry.
      select case when count(*) = 0 then null
        else round(100.0 * count(*) filter (where answered) / count(*), 1) end
      from (select i.id, exists(select 1 from public.messages m
              where m.inquiry_id = i.id and m.sender_id = i.supplier_id) answered
              from public.inquiries i where i.created_at >= v_since) y),
    'median_first_response_hours', (
      select round((percentile_cont(0.5) within group (
        order by extract(epoch from (m.first_at - i.created_at)) / 3600.0))::numeric, 1)
      from public.inquiries i
      join lateral (select min(created_at) first_at from public.messages
                     where inquiry_id = i.id and sender_id = i.supplier_id) m on true
      where m.first_at is not null and i.created_at >= v_since),
    'overdue_amount_pkr', (
      select coalesce(sum(coalesce(subtotal_pkr,0) - amount_paid_pkr), 0) from public.invoices
      where status in ('sent','acknowledged') and payment_status <> 'paid'
        and due_date is not null and due_date < current_date),
    'outstanding_amount_pkr', (
      select coalesce(sum(coalesce(subtotal_pkr,0) - amount_paid_pkr), 0) from public.invoices
      where status in ('sent','acknowledged') and payment_status <> 'paid'),
    'collected_amount_pkr', (select coalesce(sum(amount_paid_pkr),0) from public.invoices),
    'top_fabrics', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select jsonb_build_object('title', p.title, 'slug', p.slug, 'inquiries', count(*)) t
        from public.inquiry_items ii join public.inquiries i on i.id = ii.inquiry_id
        join public.products p on p.id = ii.product_id
        where i.created_at >= v_since group by p.title, p.slug
        order by count(*) desc limit 5) z),
    'top_suppliers', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select jsonb_build_object('brand_name', s.brand_name, 'inquiries', count(*)) t
        from public.inquiries i join public.suppliers s on s.id = i.supplier_id
        where i.created_at >= v_since group by s.brand_name
        order by count(*) desc limit 5) z),
    'funnel', jsonb_build_object(
      'product_views', (select count(*) from public.supplier_page_views where viewed_at >= v_since),
      'unique_view_sessions', (select count(distinct session_id) from public.supplier_page_views where viewed_at >= v_since),
      'inquiries', (select count(*) from public.inquiries where created_at >= v_since),
      'sample_requests', (select count(*) from public.sample_requests where created_at >= v_since),
      'supplier_responses', (select count(distinct i.id) from public.inquiries i
        join public.messages m on m.inquiry_id = i.id and m.sender_id = i.supplier_id
        where i.created_at >= v_since),
      'whatsapp_notifications_sent', (select count(*) from public.whatsapp_log
        where sent_at >= v_since and status = 'sent')),
    'buyer_conversion', jsonb_build_object(
      'buyers_total', (select count(*) from public.buyers),
      'buyers_with_inquiry', (select count(distinct buyer_id) from public.inquiries)),
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
