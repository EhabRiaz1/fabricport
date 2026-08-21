-- Make fabric specifications filterable.
--
-- The specs live in the `product_attributes` EAV table, which is the right home for them --
-- long-tail, supplier-editable, admin-managed. It is the wrong shape for a marketplace
-- filter: the grid query is a single flat PostgREST select, and filtering on N attributes
-- simultaneously would need N inner joins that PostgREST cannot express.
--
-- So project the handful of filterable attributes onto `products` as a jsonb column,
-- maintained by trigger and GIN-indexed. The EAV stays the source of truth; this is a
-- derived read model. Adding a facet later means editing one function, not a schema change.
--
--   spec_facets = {
--     "type": "Stock",                     -- Stock / Made to Order / Greige Stock
--     "pattern": "Solid Dyed",             -- Solid Dyed / Print / PFGD / Pattern
--     "weave": "3/1 Twill-S",
--     "knit_type": "Fleece",
--     "chemical_finish": "Soft",
--     "mechanical_finish": "Peach",
--     "garments": ["Chino", "Trousers"],   -- split out of "Chino, Trousers"
--     "fibres": ["Organic Cotton"],        -- exactly as written
--     "fibre_families": ["Cotton"]         -- what a buyer actually searches for
--   }

alter table public.products
  add column if not exists spec_facets jsonb not null default '{}'::jsonb;

comment on column public.products.spec_facets is
  'Derived read model of the filterable product_attributes, maintained by trigger. Never write directly.';

-- ---------------------------------------------------------------------------------------
-- Fibre families
--
-- Composition is free text ("Cotton 60%, Spandex 40%", or "Polyester 90% Spandex 10%" with
-- no comma), and the fibre vocabulary has a long tail -- Organic Cotton, BCI Cotton, Supima
-- Cotton, Recycled Cotton, PIMA Cotton all appear separately. A buyer filtering the
-- marketplace is looking for "cotton", so the exact fibre is kept for display and a
-- normalised family is kept for filtering.
-- ---------------------------------------------------------------------------------------
create or replace function public.fibre_family(fibre text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when fibre ilike '%cotton%'    then 'Cotton'
    when fibre ilike '%polyester%' then 'Polyester'
    when fibre ilike '%viscose%'
      or fibre ilike '%rayon%'     then 'Viscose'
    -- "Elastance" and "Elastomultiester" are how the mills spell these; group them with the
    -- stretch fibres rather than stranding them as one-off families.
    when fibre ilike '%spandex%'
      or fibre ilike '%elastan%'
      or fibre ilike '%elastom%'
      or fibre ilike '%lycra%'     then 'Elastane'
    when fibre ilike '%modal%'     then 'Modal'
    when fibre ilike '%lyocell%'
      or fibre ilike '%tencel%'    then 'Lyocell'
    when fibre ilike '%linen%'     then 'Linen'
    when fibre ilike '%bamboo%'    then 'Bamboo'
    when fibre ilike '%hemp%'      then 'Hemp'
    when fibre ilike '%wool%'      then 'Wool'
    when fibre ilike '%silk%'      then 'Silk'
    when fibre ilike '%nylon%'
      or fibre ilike '%polyamide%' then 'Nylon'
    else fibre
  end;
$$;

-- ---------------------------------------------------------------------------------------
-- Facet projection
-- ---------------------------------------------------------------------------------------
create or replace function public.compute_product_spec_facets(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with attrs as (
    select fa.slug, btrim(pa.value_text) as value
    from public.product_attributes pa
    join public.fabric_attributes fa on fa.id = pa.attribute_id
    where pa.product_id = p_product_id
      and coalesce(btrim(pa.value_text), '') <> ''
  ),
  fibres as (
    -- Pull every "<name> <number>%" pair out of the composition string. Handles both the
    -- comma-separated and space-separated shapes the legacy data uses.
    select distinct btrim(m[1]) as fibre
    from public.products p,
         lateral regexp_matches(p.composition, '([A-Za-z][A-Za-z /&-]*?)\s*\d+(?:\.\d+)?\s*%', 'g') m
    where p.id = p_product_id and p.composition is not null
  ),
  garments as (
    select distinct btrim(g) as garment
    from attrs a, lateral unnest(string_to_array(a.value, ',')) g
    where a.slug = 'recommended-use' and btrim(g) <> ''
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'type',              (select value from attrs where slug = 'type'),
    'pattern',           (select value from attrs where slug = 'solid-pattern-print'),
    'weave',             (select value from attrs where slug = 'weave'),
    'knit_type',         (select value from attrs where slug = 'knit-type'),
    'chemical_finish',   (select value from attrs where slug = 'chemical-finish'),
    'mechanical_finish', (select value from attrs where slug = 'mechanical-finish'),
    'garments',          (select jsonb_agg(garment order by garment) from garments),
    'fibres',            (select jsonb_agg(fibre order by fibre) from fibres),
    'fibre_families',    (select jsonb_agg(distinct public.fibre_family(fibre)) from fibres)
  ));
$$;

create or replace function public.refresh_product_spec_facets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  target := case tg_table_name
    when 'products' then new.id
    else coalesce(new.product_id, old.product_id)
  end;

  if target is null then
    return coalesce(new, old);
  end if;

  update public.products
  set spec_facets = public.compute_product_spec_facets(target)
  where id = target;

  return coalesce(new, old);
end;
$$;

drop trigger if exists product_attributes_refresh_facets on public.product_attributes;
create trigger product_attributes_refresh_facets
  after insert or update or delete on public.product_attributes
  for each row execute function public.refresh_product_spec_facets();

-- Composition feeds the fibre facets, so a change there has to reproject too. Guarded on the
-- column so the trigger's own UPDATE of spec_facets cannot re-enter it.
drop trigger if exists products_refresh_facets on public.products;
create trigger products_refresh_facets
  after update of composition on public.products
  for each row
  when (old.composition is distinct from new.composition)
  execute function public.refresh_product_spec_facets();

-- ---------------------------------------------------------------------------------------
-- Backfill + index
-- ---------------------------------------------------------------------------------------
update public.products
set spec_facets = public.compute_product_spec_facets(id);

-- jsonb_path_ops: smaller and faster than the default for the containment queries the
-- marketplace runs (`spec_facets @> '{"weave":"Dobby"}'`).
create index if not exists products_spec_facets_idx
  on public.products using gin (spec_facets jsonb_path_ops);
