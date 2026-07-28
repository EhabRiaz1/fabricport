-- C1: Prevent suppliers from writing admin-controlled product columns.
-- Supabase runs every logged-in user as the `authenticated` Postgres role, so
-- column-level GRANTs cannot distinguish admin from supplier. A BEFORE trigger
-- calling is_admin() is the correct mechanism. Rejects (not reverts); exempts
-- service_role so seed scripts and admin edge functions keep working.
create or replace function public.guard_product_admin_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_privileged boolean;
begin
  is_privileged := (auth.role() = 'service_role') or public.is_admin();
  if is_privileged then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Suppliers may only create draft/pending products, never pre-approved or featured.
    new.price_approved := false;
    new.price_approved_by := null;
    new.price_approved_at := null;
    new.is_featured := false;
    if new.status is distinct from 'draft'
       and new.status is distinct from 'pending_listing_request' then
      raise exception 'suppliers may only create draft products'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE path. Block granting approval and any write to lifecycle/admin columns.
  -- A supplier is allowed to CLEAR their own approval (true -> false); only
  -- GRANTING it (-> true) is forbidden. This keeps the existing InventoryPage save
  -- (which sets price_approved := false) working.
  if (new.price_approved is distinct from old.price_approved and new.price_approved = true)
     or new.price_approved_by is distinct from old.price_approved_by
     or new.price_approved_at is distinct from old.price_approved_at
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

  -- Any price change re-opens approval. Enforced here, not in the UI, so a raw
  -- API call cannot raise a price while keeping price_approved = true.
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

drop trigger if exists products_guard_admin_columns on public.products;
create trigger products_guard_admin_columns
  before insert or update on public.products
  for each row execute function public.guard_product_admin_columns();
