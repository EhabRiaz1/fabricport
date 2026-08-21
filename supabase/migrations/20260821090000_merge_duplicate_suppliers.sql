-- Merge the duplicate supplier identities left behind by the legacy migration.
--
-- Background. `scripts/seed-catalogue.ts` created placeholder auth users named
-- seed+<slug>@fabricport.internal (plus the demo account supplier@fp.com) and hung 205 real
-- products off them. `scripts/import-legacy.ts` later created a SECOND suppliers row per
-- company under the real legacy email: its slug-collision branch forked a disambiguated slug
-- instead of adopting the supplier that already existed, and its product loop never wrote
-- supplier_id on the update path. The result is 8 brands with two supplier rows each, and
-- every real supplier signing in to an inventory that belongs to an account nobody can log
-- into -- TexHub sees 2 of its 19 fabrics; Style Textile, Quality Impex and Kohinoor Mills
-- see none of theirs at all.
--
-- Ground truth. Crawling the public legacy supplier pages (fabricport.com/supplier/<slug>/)
-- gives per-brand counts that match the placeholder accounts exactly -- TexHub publishes 19
-- products and 17 + 2 = 19 -- so repointing the placeholder's rows onto the real account
-- reproduces the legacy site precisely.
--
-- This migration moves all nine supplier foreign keys onto the real-email row, hands the
-- clean slug back, and retires the placeholder without deleting it. It is idempotent: after
-- it runs no brand has both a placeholder and a real row, so a second run matches nothing.

-- No explicit BEGIN/COMMIT: migrations are already applied inside a transaction, and
-- nesting one here would commit early and defeat the rollback guarantee below.

-- Every guard_*_admin_columns() trigger rejects a party reassignment unless auth.role() is
-- 'service_role' or is_admin() is true. A migration runs as the table owner with no JWT, so
-- it is neither -- inquiries raises 'not permitted to reassign inquiry parties'. Disable the
-- five guards for this transaction only; the ENABLEs below run in the same transaction, so a
-- failure rolls every trigger back on with the rest of the work.
alter table public.products        disable trigger products_guard_admin_columns;
alter table public.products        disable trigger products_guard_fabric_group;
alter table public.inquiries       disable trigger inquiries_guard_admin_columns;
alter table public.invoices        disable trigger invoices_guard_admin_columns;
alter table public.sample_requests disable trigger sample_requests_guard;

do $$
declare
  pair record;
  clean_slug text;
  moved_products integer;
begin
  for pair in
    with tagged as (
      select
        s.id,
        lower(btrim(s.brand_name)) as brand_key,
        (u.email like 'seed+%@fabricport.internal' or u.email = 'supplier@fp.com')
          as is_placeholder
      from public.suppliers s
      join auth.users u on u.id = s.id
    )
    select
      brand_key,
      -- array_agg, not min(): Postgres has no min() for uuid.
      (array_agg(id) filter (where not is_placeholder))[1] as keep_id,
      (array_agg(id) filter (where is_placeholder))[1]     as drop_id
    from tagged
    group by brand_key
    -- Only ever merge an unambiguous 1-placeholder + 1-real pair. Anything else is left
    -- alone for a human to look at rather than guessed at.
    having count(*) filter (where is_placeholder) = 1
       and count(*) filter (where not is_placeholder) = 1
  loop
    -- 1. Move every row that points at the placeholder. All nine FKs to suppliers.id, not
    --    just products -- products.supplier_id is ON DELETE RESTRICT, and leaving inquiries
    --    or invoices behind would orphan a supplier's history from their account.
    update public.products            set supplier_id = pair.keep_id where supplier_id = pair.drop_id;
    get diagnostics moved_products = row_count;
    update public.inquiries           set supplier_id = pair.keep_id where supplier_id = pair.drop_id;
    update public.invoices            set supplier_id = pair.keep_id where supplier_id = pair.drop_id;
    update public.listing_requests    set supplier_id = pair.keep_id where supplier_id = pair.drop_id;
    update public.supplier_page_views set supplier_id = pair.keep_id where supplier_id = pair.drop_id;
    update public.catalogues          set supplier_id = pair.keep_id where supplier_id = pair.drop_id;
    update public.fabric_groups       set supplier_id = pair.keep_id where supplier_id = pair.drop_id;
    update public.payments            set supplier_id = pair.keep_id where supplier_id = pair.drop_id;
    update public.sample_requests     set supplier_id = pair.keep_id where supplier_id = pair.drop_id;

    -- 2. Carry the placeholder's branding forward wherever the survivor has none. The seed
    --    rows are the ones that were marked verified and given badges.
    update public.suppliers k
    set is_verified   = k.is_verified or d.is_verified,
        badge_label   = coalesce(k.badge_label, d.badge_label),
        website_url   = coalesce(k.website_url, d.website_url),
        instagram_url = coalesce(k.instagram_url, d.instagram_url),
        updated_at    = now()
    from public.suppliers d
    where k.id = pair.keep_id and d.id = pair.drop_id;

    -- 3. Hand the clean slug back. The placeholder holds e.g. 'texhub-pvt-ltd' while the real
    --    account was forced onto 'texhub-pvt-ltd-28b035'. slug is UNIQUE, so the placeholder
    --    must release it first. This also collapses the duplicate public /supplier/<slug>
    --    pages down to one per brand.
    select slug into clean_slug from public.suppliers where id = pair.drop_id;

    update public.suppliers
    set slug        = 'retired-' || left(pair.drop_id::text, 8),
        -- Renamed so the unique brand index below can exist while the row is kept for
        -- rollback. Retired rows are also unverified, so suppliers_public_read_verified
        -- hides them from the public site.
        brand_name  = '[retired] ' || brand_name,
        is_verified = false,
        updated_at  = now()
    where id = pair.drop_id;

    update public.suppliers
    set slug = clean_slug, updated_at = now()
    where id = pair.keep_id;

    raise notice 'merged % -> % (% products)', pair.drop_id, pair.keep_id, moved_products;
  end loop;
end;
$$;

alter table public.products        enable trigger products_guard_admin_columns;
alter table public.products        enable trigger products_guard_fabric_group;
alter table public.inquiries       enable trigger inquiries_guard_admin_columns;
alter table public.invoices        enable trigger invoices_guard_admin_columns;
alter table public.sample_requests enable trigger sample_requests_guard;

-- Make the split unrepeatable. import-legacy.ts forked a duplicate because brand_name was
-- not unique and nothing rejected the second insert; now something does.
create unique index if not exists suppliers_brand_name_unique
  on public.suppliers (lower(btrim(brand_name)));
