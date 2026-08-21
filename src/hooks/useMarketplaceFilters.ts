import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { COLOR_FAMILIES, type ColorFamily } from '@/lib/color/classify'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { countActiveFilters } from '@/lib/product-filters'
import type { MarketplaceFilters } from '@/types/app'

/**
 * Multi-select facets, and the query-string key each uses.
 *
 * Kept as one table so a new facet is a single line rather than four edits scattered through
 * the serialiser, the parser and the clear logic.
 */
const LIST_FACETS: [keyof MarketplaceFilters, string][] = [
  ['fabricTypes', 'type'],
  ['patterns', 'pattern'],
  ['weaves', 'weave'],
  ['knitTypes', 'knit'],
  ['chemicalFinishes', 'cfinish'],
  ['mechanicalFinishes', 'mfinish'],
  ['fibres', 'fibre'],
  ['garments', 'garment'],
]

export function filtersFromParams(params: URLSearchParams): MarketplaceFilters {
  const filters: MarketplaceFilters = {}
  const category = params.get('category')
  if (category) filters.categorySlug = category
  const supplier = params.get('supplier')
  if (supplier) filters.supplierSlug = supplier
  const colors = params.get('colors')
  if (colors) {
    const families = colors
      .split(',')
      .filter((c): c is ColorFamily => (COLOR_FAMILIES as readonly string[]).includes(c))
    if (families.length) filters.colorFamilies = families
  }
  const search = params.get('q')
  if (search) filters.search = search
  const sort = params.get('sort')
  if (sort === 'price_asc' || sort === 'price_desc') filters.sort = sort
  for (const [key, param] of LIST_FACETS) {
    const raw = params.get(param)
    if (raw) {
      const values = raw.split(',').map((v) => v.trim()).filter(Boolean)
      if (values.length) (filters[key] as string[]) = values
    }
  }
  for (const [key, param] of [
    ['priceMin', 'price_min'],
    ['priceMax', 'price_max'],
    ['gsmMin', 'gsm_min'],
    ['gsmMax', 'gsm_max'],
    ['widthMin', 'width_min'],
    ['widthMax', 'width_max'],
  ] as const) {
    const raw = params.get(param)
    if (raw != null && raw !== '' && !Number.isNaN(Number(raw))) {
      filters[key] = Number(raw)
    }
  }
  return filters
}

export function paramsFromFilters(filters: MarketplaceFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.categorySlug) params.set('category', filters.categorySlug)
  if (filters.supplierSlug) params.set('supplier', filters.supplierSlug)
  if (filters.colorFamilies?.length) params.set('colors', filters.colorFamilies.join(','))
  if (filters.search) params.set('q', filters.search)
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort)
  if (filters.priceMin != null) params.set('price_min', String(filters.priceMin))
  if (filters.priceMax != null) params.set('price_max', String(filters.priceMax))
  if (filters.gsmMin != null) params.set('gsm_min', String(filters.gsmMin))
  if (filters.gsmMax != null) params.set('gsm_max', String(filters.gsmMax))
  if (filters.widthMin != null) params.set('width_min', String(filters.widthMin))
  if (filters.widthMax != null) params.set('width_max', String(filters.widthMax))
  for (const [key, param] of LIST_FACETS) {
    const values = filters[key] as string[] | undefined
    if (values?.length) params.set(param, values.join(','))
  }
  return params
}

/**
 * Single owner of marketplace filter state.
 *
 * Previously this lived as raw `useState` in `MarketplacePage` with five scattered
 * `setFilters` call sites, one of which silently wiped every unrelated facet. It also only
 * ever read the URL once, at mount, so browser Back changed the address bar while the panel
 * kept showing the old selection.
 *
 * Not a zustand store: the state is URL-derived and page-scoped, so a global store would
 * need reset-on-unmount and would compete with the URL for ownership.
 */
export function useMarketplaceFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<MarketplaceFilters>(() =>
    filtersFromParams(searchParams),
  )
  const debouncedFilters = useDebouncedValue(filters, 350)

  // What we last pushed to the URL ourselves, so an incoming change can be told apart from
  // our own echo.
  const lastPushed = useRef(paramsFromFilters(filters).toString())

  useEffect(() => {
    const next = paramsFromFilters(debouncedFilters).toString()
    if (next === lastPushed.current) return
    lastPushed.current = next
    setSearchParams(next, { replace: true })
  }, [debouncedFilters, setSearchParams])

  // Rehydrate when the URL changes from outside -- Back/Forward, or a link into the page
  // with different params.
  useEffect(() => {
    const incoming = searchParams.toString()
    if (incoming === lastPushed.current) return
    lastPushed.current = incoming
    setFilters(filtersFromParams(new URLSearchParams(incoming)))
  }, [searchParams])

  const patch = useCallback((next: Partial<MarketplaceFilters>) => {
    setFilters((prev) => ({ ...prev, ...next }))
  }, [])

  /** Replaces every facet but keeps the sort order. Used by the curated edits. */
  const replaceFacets = useCallback((next: MarketplaceFilters) => {
    setFilters((prev) => ({ sort: prev.sort, ...next }))
  }, [])

  const toggleColor = useCallback((family: ColorFamily) => {
    setFilters((prev) => {
      const current = prev.colorFamilies ?? []
      const next = current.includes(family)
        ? current.filter((c) => c !== family)
        : [...current, family]
      return { ...prev, colorFamilies: next.length ? next : undefined }
    })
  }, [])

  /** Add/remove one option in a multi-select facet. */
  const toggleListValue = useCallback(
    (key: keyof MarketplaceFilters, value: string) => {
      setFilters((prev) => {
        const current = (prev[key] as string[] | undefined) ?? []
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value]
        return { ...prev, [key]: next.length ? next : undefined }
      })
    },
    [],
  )

  const clearAll = useCallback(() => {
    setFilters((prev) => ({ sort: prev.sort }))
  }, [])

  const activeCount = useMemo(() => countActiveFilters(filters), [filters])

  /** True while the debounce is still catching up, for the "Updating results…" overlay. */
  const pending = JSON.stringify(filters) !== JSON.stringify(debouncedFilters)

  return {
    filters,
    debouncedFilters,
    setFilters,
    patch,
    replaceFacets,
    toggleColor,
    toggleListValue,
    clearAll,
    activeCount,
    pending,
  }
}
