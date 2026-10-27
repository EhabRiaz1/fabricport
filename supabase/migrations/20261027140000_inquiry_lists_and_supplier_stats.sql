-- Fix list #22, #28, #39 (Oct 2026).
--
--   #22 get_supplier_response_stats: one definition of "responded".
--       responded  = the inquiry has at least one message from the supplier
--       window     = inquiries created in the last 90 days (default `since`)
--       excluded   = inquiries whose buyer or supplier profile is_demo
--       median     = median minutes from inquiry creation to the supplier's first
--                    message, over responded inquiries only
--       The previous version inner-joined messages and dropped every inquiry that
--       had no buyer message, which is how a supplier at 0% on the dashboard showed
--       100% on analytics. Admin reports must use the same definition.
--   #28 get_inquiry_list_rows: per-inquiry row for the list pages and the chat dock
--       (fabric titles, total metres, last message, unread count). SECURITY INVOKER:
--       RLS on inquiries / inquiry_items / products / messages applies unchanged. The
--       buyer's name is deliberately not resolved here; suppliers read it through
--       get_counterparty_profiles like every other supplier screen.
--   #39 get_supplier_visitor_stats / record_supplier_view: admin, demo and the
--       supplier's own visits no longer count.

-- ---------------------------------------------------------------- #22
create or replace function public.get_supplier_response_stats(
  supplier_uuid uuid,
  since timestamptz default (now() - interval '90 days')
)
returns table (
  total_inquiries int,
  responded int,
  response_rate numeric,
  median_response_minutes numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select
      i.id,
      i.created_at,
      (
        select min(m.created_at)
        from public.messages m
        where m.inquiry_id = i.id and m.sender_id = i.supplier_id
      ) as first_supplier
    from public.inquiries i
    join public.profiles bp on bp.id = i.buyer_id
    join public.profiles sp on sp.id = i.supplier_id
    where i.supplier_id = supplier_uuid
      and i.created_at >= since
      and not bp.is_demo
      and not sp.is_demo
      and (supplier_uuid = auth.uid() or public.is_admin())
  ),
  resp as (
    select
      case when first_supplier is not null
           then greatest(extract(epoch from (first_supplier - created_at)) / 60, 0)
      end as minutes
    from base
  )
  select
    count(*)::int as total_inquiries,
    count(minutes)::int as responded,
    case when count(*) > 0
      then round(count(minutes)::numeric / count(*) * 100, 0)
      else 0 end as response_rate,
    coalesce(round(percentile_cont(0.5) within group (order by minutes)::numeric, 0), 0)
      as median_response_minutes
  from resp;
$$;

grant execute on function public.get_supplier_response_stats(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------- #28
create or replace function public.get_inquiry_list_rows(p_limit int default 200)
returns table (
  id uuid,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  buyer_id uuid,
  supplier_id uuid,
  supplier_name text,
  item_titles text[],
  item_count int,
  total_meters numeric,
  last_message text,
  last_message_at timestamptz,
  last_message_sender uuid,
  unread_count int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    i.id,
    i.status,
    i.created_at,
    i.updated_at,
    i.buyer_id,
    i.supplier_id,
    s.brand_name as supplier_name,
    coalesce(items.titles, '{}'::text[]) as item_titles,
    coalesce(items.n, 0)::int as item_count,
    coalesce(items.meters, 0) as total_meters,
    lm.content as last_message,
    lm.created_at as last_message_at,
    lm.sender_id as last_message_sender,
    coalesce(unread.n, 0)::int as unread_count
  from public.inquiries i
  left join public.suppliers s on s.id = i.supplier_id
  left join lateral (
    select
      array_agg(coalesce(p.title, 'Fabric') order by ii.created_at, p.title) as titles,
      count(*) as n,
      sum(ii.quantity_meters) as meters
    from public.inquiry_items ii
    left join public.products p on p.id = ii.product_id
    where ii.inquiry_id = i.id
  ) items on true
  left join lateral (
    select m.content, m.created_at, m.sender_id
    from public.messages m
    where m.inquiry_id = i.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*) as n
    from public.messages m
    where m.inquiry_id = i.id
      and m.read_at is null
      and m.sender_id <> auth.uid()
  ) unread on true
  where i.buyer_id = auth.uid() or i.supplier_id = auth.uid()
  order by coalesce(lm.created_at, i.updated_at) desc
  limit greatest(coalesce(p_limit, 200), 1);
$$;

revoke execute on function public.get_inquiry_list_rows(int) from public, anon;
grant  execute on function public.get_inquiry_list_rows(int) to authenticated;

-- ---------------------------------------------------------------- #39
create or replace function public.get_supplier_visitor_stats(
  supplier_uuid uuid,
  since timestamptz default now() - interval '30 days'
)
returns table (
  viewer_id uuid,
  company_name text,
  full_name text,
  viewer_role text,
  visit_count bigint,
  product_views bigint,
  last_visit timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.viewer_id,
    p.company_name,
    p.full_name,
    p.role::text as viewer_role,
    count(*) as visit_count,
    count(*) filter (where v.product_id is not null) as product_views,
    max(v.viewed_at) as last_visit
  from public.supplier_page_views v
  left join public.profiles p on p.id = v.viewer_id
  where v.supplier_id = supplier_uuid
    and v.viewed_at >= since
    and v.viewer_id is not null
    and v.viewer_id <> supplier_uuid
    and coalesce(p.role, '') <> 'admin'
    and not coalesce(p.is_demo, false)
    and (supplier_uuid = auth.uid() or public.is_admin())
  group by v.viewer_id, p.company_name, p.full_name, p.role
  order by max(v.viewed_at) desc
  limit 50;
$$;

grant execute on function public.get_supplier_visitor_stats(uuid, timestamptz) to authenticated;

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
declare
  v_viewer uuid := auth.uid();
begin
  if p_supplier is null then
    return;
  end if;

  -- Staff, demo accounts and the supplier looking at their own pages are not
  -- traffic. Skipping the write keeps raw view counts honest, not only the
  -- aggregated company list.
  if v_viewer is not null then
    if v_viewer = p_supplier then
      return;
    end if;
    if exists (
      select 1 from public.profiles pr
      where pr.id = v_viewer and (pr.role = 'admin' or pr.is_demo)
    ) then
      return;
    end if;
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
    (p_supplier, p_product, v_viewer, p_session, p_referrer, now());
end;
$$;

grant execute on function public.record_supplier_view(uuid, uuid, text, text) to anon, authenticated;
