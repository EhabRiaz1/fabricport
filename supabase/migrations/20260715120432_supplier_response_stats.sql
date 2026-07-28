-- W5c: Response-rate metric for supplier analytics, computed from messages.
-- Per inquiry: time from the first buyer message to the supplier's first reply.
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
      i.id as inquiry_id,
      min(case when m.sender_id = i.buyer_id then m.created_at end) as first_buyer,
      min(case when m.sender_id = i.supplier_id then m.created_at end) as first_supplier
    from public.inquiries i
    join public.messages m on m.inquiry_id = i.id
    where i.supplier_id = supplier_uuid
      and i.created_at >= since
      and (supplier_uuid = auth.uid() or public.is_admin())
    group by i.id
  ),
  resp as (
    select
      case
        when first_supplier is not null and first_buyer is not null and first_supplier >= first_buyer
        then extract(epoch from (first_supplier - first_buyer)) / 60
      end as minutes
    from base
    where first_buyer is not null
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
