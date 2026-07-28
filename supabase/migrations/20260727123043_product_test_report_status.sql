-- Lab test result, carried over from the legacy catalogue where 350 products were
-- Approved and 127 Failed. That signal existed on the old site and was being
-- dropped entirely by the new one.
alter table public.products add column if not exists test_report_status text;
alter table public.products drop constraint if exists products_test_report_status_check;
alter table public.products add constraint products_test_report_status_check
  check (test_report_status is null or test_report_status in ('approved','failed'));

comment on column public.products.test_report_status is
  'Independent lab test outcome. Admin-controlled — a supplier cannot self-certify.';

-- Added to the existing admin-column denylist: a supplier marking their own
-- fabric "approved" would make the badge worthless.
create or replace function public.guard_product_admin_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
declare is_privileged boolean;
begin
  is_privileged := (auth.role() = 'service_role') or public.is_admin();
  if is_privileged then return new; end if;

  if tg_op = 'INSERT' then
    new.price_approved := false;
    new.price_approved_by := null;
    new.price_approved_at := null;
    new.is_featured := false;
    new.test_report_status := null;
    if new.status is distinct from 'draft'
       and new.status is distinct from 'pending_listing_request' then
      raise exception 'suppliers may only create draft products' using errcode = '42501';
    end if;
    return new;
  end if;

  if (new.price_approved is distinct from old.price_approved and new.price_approved = true)
     or new.price_approved_by is distinct from old.price_approved_by
     or new.price_approved_at is distinct from old.price_approved_at
     or new.test_report_status is distinct from old.test_report_status
     or new.status         is distinct from old.status
     or new.supplier_id    is distinct from old.supplier_id
     or new.is_featured    is distinct from old.is_featured
     or new.slug           is distinct from old.slug
     or new.published_at   is distinct from old.published_at
     or new.view_count     is distinct from old.view_count
     or new.inquiry_count  is distinct from old.inquiry_count
  then
    raise exception 'not permitted to modify admin-controlled product columns'
      using errcode = '42501';
  end if;

  if new.price_min_pkr is distinct from old.price_min_pkr
     or new.price_max_pkr is distinct from old.price_max_pkr
     or new.price_min_usd is distinct from old.price_min_usd
     or new.price_max_usd is distinct from old.price_max_usd then
    new.price_approved := false;
    new.price_approved_by := null;
    new.price_approved_at := null;
  end if;

  return new;
end;
$$;
