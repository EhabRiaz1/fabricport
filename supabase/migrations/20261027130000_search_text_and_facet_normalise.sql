-- Fix #12 (search) and #16 (junk filter values).
--
-- Search: the marketplace matched `title` only, via one ILIKE. Buyers search for a mill
-- ("azgard"), a fibre ("cotton"), a weave ("twill") or a colour as often as a fabric name,
-- and PostgREST cannot OR across the supplier join. So keep one flat, trigger-maintained
-- `search_text` column on products that concatenates everything searchable, and index it
-- with pg_trgm so a substring ILIKE stays fast.
--
-- Facets: `compute_product_spec_facets` copied attribute text raw, so "NA", "None", "-"
-- and the column header "Pattern" became filter options. `clean_facet_value` drops those
-- and trims; the projection is re-run for the whole catalogue.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- facet cleaning
create or replace function public.clean_facet_value(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when raw is null then null
    when btrim(raw) = '' then null
    when lower(btrim(raw)) in (
      'na', 'n/a', 'n.a', 'n.a.', 'none', 'null', 'nil', '-', '--', '—', '.', '0',
      'pattern', 'type', 'weave', 'knit type', 'finish', 'tbd', 'tba', 'unknown'
    ) then null
    else btrim(raw)
  end;
$$;

create or replace function public.compute_product_spec_facets(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with attrs as (
    select fa.slug, public.clean_facet_value(pa.value_text) as value
    from public.product_attributes pa
    join public.fabric_attributes fa on fa.id = pa.attribute_id
    where pa.product_id = p_product_id
      and public.clean_facet_value(pa.value_text) is not null
  ),
  fibres as (
    select distinct btrim(m[1]) as fibre
    from public.products p,
         lateral regexp_matches(p.composition, '([A-Za-z][A-Za-z /&-]*?)\s*\d+(?:\.\d+)?\s*%', 'g') m
    where p.id = p_product_id and p.composition is not null
  ),
  garments as (
    select distinct public.clean_facet_value(g) as garment
    from attrs a, lateral unnest(string_to_array(a.value, ',')) g
    where a.slug = 'recommended-use' and public.clean_facet_value(g) is not null
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'type',              (select value from attrs where slug = 'type' limit 1),
    'pattern',           (select value from attrs where slug = 'solid-pattern-print' limit 1),
    'weave',             (select value from attrs where slug = 'weave' limit 1),
    'knit_type',         (select value from attrs where slug = 'knit-type' limit 1),
    'chemical_finish',   (select value from attrs where slug = 'chemical-finish' limit 1),
    'mechanical_finish', (select value from attrs where slug = 'mechanical-finish' limit 1),
    'garments',          (select jsonb_agg(garment order by garment) from garments),
    'fibres',            (select jsonb_agg(fibre order by fibre) from fibres),
    'fibre_families',    (select jsonb_agg(distinct public.fibre_family(fibre)) from fibres)
  ));
$$;

-- ---------------------------------------------------------------- search text
alter table public.products
  add column if not exists search_text text not null default '';

comment on column public.products.search_text is
  'Derived: title, supplier, category, composition, colour and spec facets, for marketplace search. Maintained by trigger; never write directly.';

create or replace function public.compute_product_search_text(p public.products)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(concat_ws(' ',
    p.title,
    p.slug,
    (select s.brand_name from public.suppliers s where s.id = p.supplier_id),
    (select c.name from public.fabric_categories c where c.id = p.category_id),
    p.composition,
    p.color_family,
    (select cf.name from public.color_families cf where cf.slug = p.color_family),
    p.spec_facets ->> 'weave',
    p.spec_facets ->> 'knit_type',
    p.spec_facets ->> 'pattern',
    p.spec_facets ->> 'type',
    (select string_agg(x, ' ') from jsonb_array_elements_text(coalesce(p.spec_facets -> 'fibres', '[]'::jsonb)) x),
    (select string_agg(x, ' ') from jsonb_array_elements_text(coalesce(p.spec_facets -> 'fibre_families', '[]'::jsonb)) x),
    (select string_agg(x, ' ') from jsonb_array_elements_text(coalesce(p.spec_facets -> 'garments', '[]'::jsonb)) x)
  ));
$$;

-- Internal helper; nothing in the API calls it.
revoke execute on function public.compute_product_search_text(public.products) from public, anon, authenticated;

create or replace function public.set_product_search_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.search_text := public.compute_product_search_text(new);
  return new;
end;
$$;
revoke execute on function public.set_product_search_text() from public, anon, authenticated;

drop trigger if exists products_set_search_text on public.products;
create trigger products_set_search_text
  before insert or update on public.products
  for each row execute function public.set_product_search_text();

-- A renamed mill has to reach its products' search text too.
create or replace function public.refresh_supplier_products_search_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.brand_name is distinct from old.brand_name then
    update public.products set search_text = search_text where supplier_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.refresh_supplier_products_search_text() from public, anon, authenticated;

drop trigger if exists suppliers_refresh_search_text on public.suppliers;
create trigger suppliers_refresh_search_text
  after update of brand_name on public.suppliers
  for each row execute function public.refresh_supplier_products_search_text();

create index if not exists products_search_text_trgm_idx
  on public.products using gin (search_text extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- backfill
-- Re-project facets with the cleaner, which also fires the search_text trigger.
update public.products
set spec_facets = public.compute_product_spec_facets(id);

-- Rows whose facets did not change still need search_text populated.
update public.products set search_text = search_text where search_text = '';
