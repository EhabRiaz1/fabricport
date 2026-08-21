import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'
import type { MarketplaceFilters } from '@/types/app'

/**
 * Which `spec_facets` keys hold a single value and which hold an array.
 *
 * `spec_facets` is the trigger-maintained projection of the product_attributes EAV onto
 * `products` (see the product_spec_facets migration). Filtering it here keeps the grid query
 * a single flat select -- the EAV itself would need one inner join per facet, which
 * PostgREST cannot express.
 */
const SCALAR_FACETS = {
  fabricTypes: 'type',
  patterns: 'pattern',
  weaves: 'weave',
  knitTypes: 'knit_type',
  chemicalFinishes: 'chemical_finish',
  mechanicalFinishes: 'mechanical_finish',
} as const satisfies Partial<Record<keyof MarketplaceFilters, string>>

const ARRAY_FACETS = {
  fibres: 'fibre_families',
  garments: 'garments',
} as const satisfies Partial<Record<keyof MarketplaceFilters, string>>

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyQuery = PostgrestFilterBuilder<any, any, any, any, any>

/**
 * Applies every marketplace facet to a products query.
 *
 * Extracted because `fetchProductsPage` had these predicates written out twice -- once for
 * the paginated grid and once for the unpaginated callers -- and the two had already drifted.
 * Any new facet added here reaches both.
 *
 * Selections within one facet are OR'd (blue OR green); separate facets are AND'd. That is
 * what people expect from a faceted filter, and it is what the counts alongside each option
 * are counting.
 */
export function applyProductFilters<Q extends AnyQuery>(
  query: Q,
  filters: MarketplaceFilters | undefined,
  ids: { supplierId?: string | null; categoryId?: string | null } = {},
): Q {
  let q = query

  if (filters?.search) q = q.ilike('title', `%${filters.search}%`) as Q
  if (filters?.colorFamilies?.length) q = q.in('color_family', filters.colorFamilies) as Q

  if (filters?.priceMin != null) q = q.gte('price_min_pkr', filters.priceMin) as Q
  if (filters?.priceMax != null) q = q.lte('price_max_pkr', filters.priceMax) as Q

  // GSM and width are real columns, so they filter server-side. Doing GSM client-side after
  // pagination (as an earlier version did) corrupted `total` and `hasMore`.
  if (filters?.gsmMin != null) q = q.gte('gsm', filters.gsmMin) as Q
  if (filters?.gsmMax != null) q = q.lte('gsm', filters.gsmMax) as Q
  if (filters?.widthMin != null) q = q.gte('width_inches', filters.widthMin) as Q
  if (filters?.widthMax != null) q = q.lte('width_inches', filters.widthMax) as Q

  if (ids.supplierId) q = q.eq('supplier_id', ids.supplierId) as Q
  if (ids.categoryId) q = q.eq('category_id', ids.categoryId) as Q

  for (const [key, facet] of Object.entries(SCALAR_FACETS)) {
    const selected = filters?.[key as keyof MarketplaceFilters] as string[] | undefined
    if (selected?.length) q = q.in(`spec_facets->>${facet}`, selected) as Q
  }

  for (const [key, facet] of Object.entries(ARRAY_FACETS)) {
    const selected = filters?.[key as keyof MarketplaceFilters] as string[] | undefined
    if (!selected?.length) continue
    // `cs` is contains-ALL, so one condition per selection OR'd together gives contains-ANY.
    // Values are single fibre or garment names -- commas were split out upstream, which
    // matters because a comma inside an or() would be read as a condition separator.
    q = q.or(
      selected.map((value) => `spec_facets->${facet}.cs.["${value}"]`).join(','),
    ) as Q
  }

  return q
}

/** Number of user-visible facets in play. Sort is not a filter. */
export function countActiveFilters(filters: MarketplaceFilters): number {
  let n = 0
  if (filters.categorySlug) n++
  if (filters.supplierSlug) n++
  if (filters.colorFamilies?.length) n += filters.colorFamilies.length
  if (filters.priceMin != null || filters.priceMax != null) n++
  if (filters.gsmMin != null || filters.gsmMax != null) n++
  if (filters.widthMin != null || filters.widthMax != null) n++
  if (filters.search) n++
  for (const key of [...Object.keys(SCALAR_FACETS), ...Object.keys(ARRAY_FACETS)]) {
    const selected = filters[key as keyof MarketplaceFilters] as string[] | undefined
    n += selected?.length ?? 0
  }
  return n
}

export { SCALAR_FACETS, ARRAY_FACETS }
