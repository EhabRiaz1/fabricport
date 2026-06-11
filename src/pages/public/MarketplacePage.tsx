import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PublicNav } from '@/components/layout/PublicNav'
import { Footer } from '@/components/layout/Footer'
import { FilterDock, ActiveFilterChips } from '@/components/marketplace/FilterDock'
import { ArchiveHero } from '@/components/marketplace/ArchiveHero'
import { ColorSpectrum } from '@/components/marketplace/ColorSpectrum'
import { FabricCard } from '@/components/marketplace/FabricCard'
import { UnitToggle } from '@/components/marketplace/UnitToggle'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useProducts, MARKETPLACE_PAGE_SIZE } from '@/hooks/useProducts'
import { useSuppliers } from '@/hooks/useSuppliers'
import { getFxRate } from '@/lib/fx'
import { COLOR_FAMILIES, type ColorFamily } from '@/lib/color/classify'
import { marketplaceReveal, marketplaceRevealDelayed } from '@/lib/motion'
import { usePagePresence } from '@/lib/track'
import { supabase } from '@/lib/supabase'
import { usePreferencesStore } from '@/stores/preferences'
import type { FabricFilterOption, MarketplaceFilters, MarketplaceSort } from '@/types/app'

const SORT_OPTIONS: { value: MarketplaceSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
]

interface CuratedEdit {
  key: string
  title: string
  description: string
  filters: MarketplaceFilters
}

const CURATED_EDITS: CuratedEdit[] = [
  {
    key: 'heavyweight',
    title: 'Heavyweight',
    description: 'Denim, canvas & twill at 300 GSM and up.',
    filters: { gsmMin: 300 },
  },
  {
    key: 'featherlight',
    title: 'Featherlight',
    description: 'Voiles, lawns & shirting under 100 GSM.',
    filters: { gsmMax: 100 },
  },
  {
    key: 'smart-buys',
    title: 'Smart Buys',
    description: 'Verified quality under PKR 300 a metre.',
    filters: { priceMax: 300 },
  },
]

function filtersFromParams(params: URLSearchParams): MarketplaceFilters {
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
  for (const [key, param] of [
    ['priceMin', 'price_min'],
    ['priceMax', 'price_max'],
    ['gsmMin', 'gsm_min'],
    ['gsmMax', 'gsm_max'],
  ] as const) {
    const raw = params.get(param)
    if (raw != null && raw !== '' && !Number.isNaN(Number(raw))) {
      filters[key] = Number(raw)
    }
  }
  return filters
}

function paramsFromFilters(filters: MarketplaceFilters): URLSearchParams {
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
  return params
}

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<MarketplaceFilters>(() =>
    filtersFromParams(searchParams),
  )
  const debouncedFilters = useDebouncedValue(filters, 350)
  const [categories, setCategories] = useState<FabricFilterOption[]>([])
  const [facetCounts, setFacetCounts] = useState<{
    bySupplier: Record<string, number>
    byCategory: Record<string, number>
    byColor: Partial<Record<ColorFamily, number>>
    totalMeters: number
    totalPublished: number
  }>({ bySupplier: {}, byCategory: {}, byColor: {}, totalMeters: 0, totalPublished: 0 })
  const [fxRate, setFxRate] = useState(278)
  const { currency, unit } = usePreferencesStore()
  const {
    products,
    loading,
    loadingMore,
    error,
    loadMore,
    hasMore,
    total,
  } = useProducts({ filters: debouncedFilters, paginated: true })
  const { suppliers } = useSuppliers({ verifiedOnly: true, skipProductCounts: true })

  usePagePresence({ path: '/marketplace' })

  // Keep the URL shareable — reflect debounced filters into search params.
  useEffect(() => {
    setSearchParams(paramsFromFilters(debouncedFilters), { replace: true })
  }, [debouncedFilters, setSearchParams])

  useEffect(() => {
    getFxRate().then(setFxRate).catch(() => undefined)
  }, [])

  useEffect(() => {
    async function loadFacets() {
      const [categoriesRes, productsRes] = await Promise.all([
        supabase.from('fabric_categories').select('id, name, slug').order('name'),
        supabase
          .from('products')
          .select('supplier_id, category_id, color_family, stock_meters')
          .eq('status', 'published'),
      ])

      const bySupplier: Record<string, number> = {}
      const byCategory: Record<string, number> = {}
      const byColor: Partial<Record<ColorFamily, number>> = {}
      let totalMeters = 0
      const rows = productsRes.data ?? []
      for (const row of rows) {
        if (row.supplier_id) bySupplier[row.supplier_id] = (bySupplier[row.supplier_id] ?? 0) + 1
        if (row.category_id) byCategory[row.category_id] = (byCategory[row.category_id] ?? 0) + 1
        if (row.color_family && (COLOR_FAMILIES as readonly string[]).includes(row.color_family)) {
          const family = row.color_family as ColorFamily
          byColor[family] = (byColor[family] ?? 0) + 1
        }
        totalMeters += row.stock_meters ?? 0
      }
      setFacetCounts({ bySupplier, byCategory, byColor, totalMeters, totalPublished: rows.length })

      setCategories(
        (categoriesRes.data ?? []).map((category) => ({
          slug: category.slug,
          label: category.name,
          count: byCategory[category.id] ?? 0,
        })),
      )
    }

    loadFacets()
  }, [])

  const supplierOptions = useMemo<FabricFilterOption[]>(
    () =>
      suppliers.map((supplier) => ({
        slug: supplier.slug,
        label: supplier.brand_name,
        count: facetCounts.bySupplier[supplier.id] ?? 0,
      })),
    [suppliers, facetCounts.bySupplier],
  )

  const filtersPending = useMemo(
    () => JSON.stringify(filters) !== JSON.stringify(debouncedFilters),
    [filters, debouncedFilters],
  )
  const refreshingResults = loading && products.length > 0
  const showResultsLoading = filtersPending || refreshingResults

  const loadMoreRef = useRef<HTMLDivElement>(null)
  const gridSectionRef = useRef<HTMLElement>(null)

  const interludes = useMemo(
    () => [
      {
        kicker: 'Surplus, rescued',
        text: `${
          facetCounts.totalMeters >= 1_000_000
            ? `${(facetCounts.totalMeters / 1_000_000).toFixed(1)} million`
            : facetCounts.totalMeters.toLocaleString()
        } metres of verified deadstock — scanned, spec'd and saved from landfill.`,
      },
      {
        kicker: 'Measured in-house',
        text: 'Every roll is inspected by our studio. GSM, width and composition — measured, not copied from a label.',
      },
      {
        kicker: 'Direct from the source',
        text: `${supplierOptions.length} verified Pakistani mills. No brokers, no middlemen, no surprises.`,
      },
    ],
    [facetCounts.totalMeters, supplierOptions.length],
  )

  function scrollToGrid() {
    gridSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && !loadingMore && !loading) {
          void loadMore()
        }
      },
      { rootMargin: '240px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, loadMore])

  return (
    <div className="min-h-screen bg-[#F6F1E9]">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={marketplaceReveal}
      >
        <PublicNav />
      </motion.div>

      <ArchiveHero
        totalFabrics={facetCounts.totalPublished || total}
        totalMills={supplierOptions.length}
        totalMeters={facetCounts.totalMeters}
      />

      <main className="w-full px-6 pb-32 pt-10 sm:px-10 lg:px-14 xl:px-20">
        {/* Colour spectrum + curated edits — discovery layer above the grid */}
        <motion.div
          className="px-2 sm:px-3"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={marketplaceReveal}
        >
          <ColorSpectrum
            counts={facetCounts.byColor}
            selected={filters.colorFamilies ?? []}
            onToggle={(family) => {
              setFilters((prev) => {
                const current = prev.colorFamilies ?? []
                const next = current.includes(family)
                  ? current.filter((f) => f !== family)
                  : [...current, family]
                return { ...prev, colorFamilies: next.length > 0 ? next : undefined }
              })
              scrollToGrid()
            }}
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {CURATED_EDITS.map((edit) => (
              <button
                key={edit.key}
                type="button"
                onClick={() => {
                  setFilters((prev) => ({ sort: prev.sort, ...edit.filters }))
                  scrollToGrid()
                }}
                className="group grain relative overflow-hidden border border-[#2C1A0E]/15 bg-[#2C1A0E] px-6 py-7 text-left transition-colors duration-300 hover:bg-[#3C2A1A] clip-corner-sm"
              >
                <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-[#E8A070]">
                  Curated edit
                </p>
                <p className="mt-2 font-display text-xl font-semibold tracking-tight text-[#F5EDE4] sm:text-2xl">
                  {edit.title}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#F5EDE4]/50">
                  {edit.description}
                </p>
                <ArrowRight className="absolute bottom-6 right-5 h-4 w-4 text-[#F5EDE4]/30 transition-all duration-300 group-hover:translate-x-1 group-hover:text-[#E8A070]" />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Toolbar + grid share a section so sticky spans the results scroll */}
        <section ref={gridSectionRef} className="mt-10 scroll-mt-[68px]">
          <div className="sticky top-[60px] z-40 border-b border-[#3C2A1A]/8 bg-[#F6F1E9]/96 px-2 backdrop-blur-xl sm:px-3">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                <p className="shrink-0 font-display text-base font-semibold tracking-tight text-[#2C1A0E]">
                  {loading && products.length === 0 ? 'Catalogue' : `${total || products.length} fabrics`}
                </p>
                <ActiveFilterChips
                  filters={filters}
                  onChange={setFilters}
                  categories={categories}
                  suppliers={supplierOptions}
                />
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center border border-[#C8C4BC] bg-[#E8E4DC]">
                  <span className="flex items-center gap-1.5 border-r border-[#C8C4BC] px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#3C2A1A]/50">
                    <ArrowUpDown className="h-3 w-3" />
                    Sort
                  </span>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          sort: option.value === 'newest' ? undefined : option.value,
                        }))
                      }
                      className={cn(
                        'px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
                        (filters.sort ?? 'newest') === option.value
                          ? 'bg-[#2C1A0E] text-[#E8E4DC]'
                          : 'text-[#3C2A1A]/60 hover:text-[#2C1A0E]',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <UnitToggle variant="warm" />
              </div>
            </div>

            {categories.length > 0 && (
              <div className="scrollbar-none -mx-2 flex gap-2 overflow-x-auto px-2 pb-3 sm:-mx-3 sm:px-3">
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, categorySlug: undefined }))}
                  className={cn(
                    'shrink-0 border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                    !filters.categorySlug
                      ? 'border-[#2C1A0E] bg-[#2C1A0E] text-[#E8E4DC]'
                      : 'border-[#C8C4BC] text-[#3C2A1A]/60 hover:border-[#2C1A0E]/50 hover:text-[#2C1A0E]',
                  )}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() =>
                      setFilters((prev) => ({
                        ...prev,
                        categorySlug: prev.categorySlug === cat.slug ? undefined : cat.slug,
                      }))
                    }
                    className={cn(
                      'shrink-0 border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                      filters.categorySlug === cat.slug
                        ? 'border-[#2C1A0E] bg-[#2C1A0E] text-[#E8E4DC]'
                        : 'border-[#C8C4BC] text-[#3C2A1A]/60 hover:border-[#2C1A0E]/50 hover:text-[#2C1A0E]',
                    )}
                  >
                    {cat.label}
                    {(cat.count ?? 0) > 0 && (
                      <span
                        className={cn(
                          'ml-2',
                          filters.categorySlug === cat.slug
                            ? 'text-[#E8E4DC]/60'
                            : 'text-[#3C2A1A]/35',
                        )}
                      >
                        {cat.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <motion.div
            className="mt-5"
            initial="hidden"
            animate="visible"
            variants={marketplaceRevealDelayed}
          >
            {error && (
              <p className="mb-6 font-mono text-sm text-danger">
                Failed to load products: {error}
              </p>
            )}

            <div className="relative">
              {showResultsLoading && (
                <div
                  className="absolute inset-0 z-10 flex items-start justify-center bg-[#F6F1E9]/60 pt-20"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="h-9 w-9 animate-spin rounded-full border-2 border-[#3C2A1A]/15 border-t-accent"
                      role="status"
                      aria-label="Loading results"
                    />
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#3C2A1A]/55">
                      Updating results…
                    </p>
                  </div>
                </div>
              )}

              <div
                className={cn(
                  'grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 lg:grid-cols-3 lg:gap-12 transition-opacity duration-200',
                  showResultsLoading && 'pointer-events-none opacity-40',
                )}
              >
                {loading &&
                  products.length === 0 &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="p-2 sm:p-3">
                      <Skeleton className="aspect-square w-full clip-corner bg-[#E8E4DC]/10" />
                    </div>
                  ))}

                {products.map((product, index) => (
                  <Fragment key={product.id}>
                    <motion.div
                      className="p-2 sm:p-3"
                      initial={{ opacity: 0, y: 28 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{
                        duration: 0.5,
                        delay: (index % 3) * 0.07,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <FabricCard
                        product={product}
                        variant="grid"
                        currency={currency}
                        unit={unit}
                        fxRate={fxRate}
                        imagePriority={index < MARKETPLACE_PAGE_SIZE}
                      />
                    </motion.div>
                    {(index + 1) % 12 === 0 && index + 1 < products.length && (
                      <motion.div
                        className="p-2 sm:col-span-2 sm:p-3"
                        initial={{ opacity: 0, y: 28 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <div className="grain relative flex h-full min-h-[200px] flex-col justify-center overflow-hidden border border-[#2C1A0E]/15 bg-[#2C1A0E] px-8 py-10 clip-corner sm:px-12">
                          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#E8A070]">
                            {interludes[((index + 1) / 12 - 1) % interludes.length].kicker}
                          </p>
                          <p
                            className="mt-3 max-w-xl font-display font-semibold tracking-tight text-[#F5EDE4]"
                            style={{ fontSize: 'clamp(20px, 2.4vw, 32px)', lineHeight: 1.15 }}
                          >
                            {interludes[((index + 1) / 12 - 1) % interludes.length].text}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>

            {hasMore && (
              <div
                ref={loadMoreRef}
                className="mt-10 flex justify-center py-4"
                aria-hidden
              >
                {loadingMore && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#3C2A1A]/40">
                    Loading more… ({products.length} of {total})
                  </p>
                )}
              </div>
            )}

            {!loading && products.length === 0 && !error && (
              <div className="clip-corner mt-6 border border-[#3C2A1A]/10 bg-[#E8E4DC] px-8 py-16 text-center text-[#2C1A0E]">
                <p className="font-display text-xl font-semibold tracking-tight">
                  No fabrics match your filters
                </p>
                <p className="mt-3 text-sm text-[#3C2A1A]/55">
                  Try adjusting filters or check back when new inventory is published.
                </p>
              </div>
            )}
          </motion.div>
        </section>
      </main>

      <FilterDock
        filters={filters}
        onChange={setFilters}
        categories={categories}
        suppliers={supplierOptions}
        resultCount={total || products.length}
        resultsLoading={showResultsLoading}
      />

      <motion.div
        initial="hidden"
        animate="visible"
        variants={marketplaceRevealDelayed}
      >
        <Footer />
      </motion.div>
    </div>
  )
}
