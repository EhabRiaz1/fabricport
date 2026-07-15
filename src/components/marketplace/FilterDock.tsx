import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion'
import { ChevronUp, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COLOR_FAMILIES } from '@/lib/color/classify'
import type { ColorFamily } from '@/lib/color/classify'
import type { FabricFilterOption, MarketplaceFilters } from '@/types/app'
import { Input } from '@/components/ui/input'

const COLOR_SWATCHES: Partial<Record<ColorFamily, string>> = {
  black: '#1A1A1A',
  white: '#F5F5F5',
  gray: '#808080',
  beige: '#D4C4A8',
  brown: '#6B4423',
  red: '#C0392B',
  orange: '#E8593C',
  yellow: '#F1C40F',
  green: '#27AE60',
  blue: '#2980B9',
  purple: '#8E44AD',
  pink: '#E91E8C',
}

const drawerSpring = { type: 'spring', stiffness: 320, damping: 34, mass: 0.9 } as const

export function countActiveFilters(filters: MarketplaceFilters): number {
  let n = 0
  if (filters.categorySlug) n++
  if (filters.supplierSlug) n++
  if (filters.colorFamilies?.length) n += filters.colorFamilies.length
  if (filters.priceMin != null || filters.priceMax != null) n++
  if (filters.gsmMin != null || filters.gsmMax != null) n++
  if (filters.search) n++
  return n
}

function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
  count?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-all duration-200',
        active
          ? 'border-[#2C1A0E] bg-[#2C1A0E] text-[#E8E4DC]'
          : 'border-[#C8C4BC] bg-transparent text-[#3C2A1A]/70 hover:border-[#2C1A0E]/50 hover:text-[#2C1A0E]',
      )}
    >
      {children}
      {count != null && count > 0 && (
        <span className={cn('ml-2', active ? 'text-[#E8E4DC]/60' : 'text-[#3C2A1A]/35')}>
          {count}
        </span>
      )}
    </button>
  )
}

function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-[#2C1A0E]">
        {label}
      </p>
      {children}
    </div>
  )
}

export interface FilterDockProps {
  filters: MarketplaceFilters
  onChange: (filters: MarketplaceFilters) => void
  categories?: FabricFilterOption[]
  suppliers?: FabricFilterOption[]
  /** Live result count shown on the apply button. */
  resultCount?: number
  resultsLoading?: boolean
}

/**
 * Bottom-anchored filter experience: a floating dock pill that pulls a
 * full-width drawer up from the bottom edge. Rendered through a portal so no
 * ancestor clip-path / backdrop-filter can clip or trap it.
 */
export function FilterDock({
  filters,
  onChange,
  categories = [],
  suppliers = [],
  resultCount,
  resultsLoading = false,
}: FilterDockProps) {
  const [open, setOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const dragControls = useDragControls()
  const activeCount = countActiveFilters(filters)

  // One-time attention hint: the dock springs in, then gives two soft bounces.
  const [hintDone, setHintDone] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('fp-dock-hint') === '1',
  )

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Lock page scroll while the drawer is up.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  function update(partial: Partial<MarketplaceFilters>) {
    onChange({ ...filters, ...partial })
  }

  function toggleColorFamily(family: ColorFamily) {
    const current = filters.colorFamilies ?? []
    const next = current.includes(family)
      ? current.filter((f) => f !== family)
      : [...current, family]
    update({ colorFamilies: next.length > 0 ? next : undefined })
  }

  const rangeInputClass =
    'h-11 border-[#C8C4BC] bg-[#F6F1E9] text-[#2C1A0E] placeholder:text-[#3C2A1A]/30'

  const dock = (
    <>
      {/* ——— Dock pill ——— */}
      <AnimatePresence>
        {!open && (
          <motion.div
            key="filter-dock-pill"
            className="pointer-events-none fixed inset-x-0 z-50 flex justify-center"
            style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
            initial={{ y: 96, opacity: 0 }}
            animate={
              prefersReducedMotion || hintDone
                ? { y: 0, opacity: 1 }
                : {
                    y: [96, 0, -14, 0, -7, 0],
                    opacity: 1,
                    transition: {
                      delay: 0.7,
                      duration: 1.6,
                      times: [0, 0.3, 0.5, 0.68, 0.84, 1],
                      ease: 'easeOut',
                    },
                  }
            }
            exit={{ y: 96, opacity: 0, transition: { duration: 0.25 } }}
            onAnimationComplete={() => {
              if (!hintDone) {
                sessionStorage.setItem('fp-dock-hint', '1')
                setHintDone(true)
              }
            }}
          >
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="marketplace-filter-drawer"
              className="group pointer-events-auto flex items-center gap-4 border border-[#F5EDE4]/15 bg-[#2C1A0E] py-3 pl-5 pr-4 text-[#F5EDE4] shadow-[0_18px_48px_-12px_rgba(44,26,14,0.55)] clip-corner-sm"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              <SlidersHorizontal className="h-4 w-4 text-[#E8A070]" />
              <span className="flex flex-col items-start leading-none">
                <span className="font-display text-sm font-semibold tracking-tight">
                  Refine selection
                </span>
                <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F5EDE4]/50">
                  {activeCount > 0
                    ? `${activeCount} filter${activeCount === 1 ? '' : 's'} active`
                    : 'Category · Colour · Specs'}
                </span>
              </span>
              {activeCount > 0 && (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#E8A070] font-mono text-[10px] font-bold text-[#2C1A0E]">
                  {activeCount}
                </span>
              )}
              <motion.span
                aria-hidden
                animate={prefersReducedMotion ? undefined : { y: [0, -3, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="ml-1 grid h-8 w-8 place-items-center border border-[#F5EDE4]/15 transition-colors group-hover:border-[#E8A070]/60"
              >
                <ChevronUp className="h-4 w-4" />
              </motion.span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ——— Backdrop + drawer ——— */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="filter-drawer-backdrop"
              className="fixed inset-0 z-50 bg-[#1A0E06]/40 backdrop-blur-[6px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              key="filter-drawer"
              id="marketplace-filter-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Refine selection"
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col border-t border-[#2C1A0E]/15 bg-[#EFEAE0] shadow-[0_-24px_80px_-20px_rgba(26,14,6,0.45)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={prefersReducedMotion ? { duration: 0 } : drawerSpring}
              drag={prefersReducedMotion ? false : 'y'}
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 600) setOpen(false)
              }}
            >
              {/* Drag handle + header — grab here to pull the drawer closed */}
              <div
                className="shrink-0 cursor-grab touch-none border-b border-[#C8C4BC] bg-[#F6F1E9] active:cursor-grabbing"
                onPointerDown={(event) => {
                  if (!prefersReducedMotion) dragControls.start(event)
                }}
              >
                <div className="flex justify-center pt-3" aria-hidden>
                  <span className="h-1 w-12 rounded-full bg-[#2C1A0E]/20" />
                </div>
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 pb-4 pt-2 sm:px-10">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#3C2A1A]/50">
                      Filters
                    </p>
                    <p className="mt-1 font-display text-lg font-semibold tracking-tight text-[#2C1A0E] sm:text-xl">
                      Refine selection
                      {activeCount > 0 && (
                        <span className="ml-3 font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-accent">
                          {activeCount} active
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close filters"
                    className="grid h-10 w-10 place-items-center border border-[#C8C4BC] text-[#3C2A1A]/60 transition-colors hover:border-[#2C1A0E] hover:text-[#2C1A0E]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-8 sm:px-10 lg:grid-cols-2">
                  {categories.length > 0 && (
                    <FilterSection label="Category">
                      <div className="flex flex-wrap gap-2">
                        <FilterChip
                          active={!filters.categorySlug}
                          onClick={() => update({ categorySlug: undefined })}
                        >
                          All
                        </FilterChip>
                        {categories.map((cat) => (
                          <FilterChip
                            key={cat.slug}
                            active={filters.categorySlug === cat.slug}
                            onClick={() =>
                              update({
                                categorySlug:
                                  filters.categorySlug === cat.slug ? undefined : cat.slug,
                              })
                            }
                            count={cat.count}
                          >
                            {cat.label}
                          </FilterChip>
                        ))}
                      </div>
                    </FilterSection>
                  )}

                  {suppliers.length > 0 && (
                    <FilterSection label="Supplier">
                      <div className="flex flex-wrap gap-2">
                        <FilterChip
                          active={!filters.supplierSlug}
                          onClick={() => update({ supplierSlug: undefined })}
                        >
                          All
                        </FilterChip>
                        {suppliers.map((supplier) => (
                          <FilterChip
                            key={supplier.slug}
                            active={filters.supplierSlug === supplier.slug}
                            onClick={() =>
                              update({
                                supplierSlug:
                                  filters.supplierSlug === supplier.slug
                                    ? undefined
                                    : supplier.slug,
                              })
                            }
                            count={supplier.count}
                          >
                            {supplier.label}
                          </FilterChip>
                        ))}
                      </div>
                    </FilterSection>
                  )}

                  <FilterSection label="Colour">
                    <div className="flex flex-wrap gap-2">
                      {COLOR_FAMILIES.map((family) => {
                        const selected = filters.colorFamilies?.includes(family)
                        return (
                          <button
                            key={family}
                            type="button"
                            onClick={() => toggleColorFamily(family)}
                            className={cn(
                              'flex shrink-0 items-center gap-2 border px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-all duration-200',
                              selected
                                ? 'border-[#2C1A0E] bg-[#2C1A0E] text-[#E8E4DC]'
                                : 'border-[#C8C4BC] text-[#3C2A1A]/70 hover:border-[#2C1A0E]/50',
                            )}
                          >
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-[#2C1A0E]/20"
                              style={{ backgroundColor: COLOR_SWATCHES[family] }}
                            />
                            {family}
                          </button>
                        )
                      })}
                    </div>
                  </FilterSection>

                  <FilterSection label="Specs & search">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="space-y-3">
                        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#3C2A1A]/50">
                          Price (PKR / m)
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={filters.priceMin ?? ''}
                            onChange={(e) =>
                              update({
                                priceMin: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className={rangeInputClass}
                          />
                          <Input
                            type="number"
                            placeholder="Max"
                            value={filters.priceMax ?? ''}
                            onChange={(e) =>
                              update({
                                priceMax: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className={rangeInputClass}
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#3C2A1A]/50">
                          GSM
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            type="number"
                            placeholder="Min"
                            value={filters.gsmMin ?? ''}
                            onChange={(e) =>
                              update({
                                gsmMin: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className={rangeInputClass}
                          />
                          <Input
                            type="number"
                            placeholder="Max"
                            value={filters.gsmMax ?? ''}
                            onChange={(e) =>
                              update({
                                gsmMax: e.target.value ? Number(e.target.value) : undefined,
                              })
                            }
                            className={rangeInputClass}
                          />
                        </div>
                      </div>
                      <div className="space-y-3 sm:col-span-2">
                        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#3C2A1A]/50">
                          Search
                        </p>
                        <Input
                          type="search"
                          placeholder="Fabric name or SKU…"
                          value={filters.search ?? ''}
                          onChange={(e) => update({ search: e.target.value || undefined })}
                          className={rangeInputClass}
                        />
                      </div>
                    </div>
                  </FilterSection>
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-[#C8C4BC] bg-[#F6F1E9]">
                <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4 sm:px-10">
                  <button
                    type="button"
                    onClick={() => onChange({ sort: filters.sort })}
                    disabled={activeCount === 0}
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-widest transition-colors',
                      activeCount > 0
                        ? 'text-accent hover:text-[#2C1A0E]'
                        : 'cursor-default text-[#3C2A1A]/25',
                    )}
                  >
                    Clear all
                  </button>
                  <motion.button
                    type="button"
                    onClick={() => setOpen(false)}
                    whileTap={{ scale: 0.97 }}
                    className="bg-[#2C1A0E] px-10 py-3.5 font-mono text-[10px] uppercase tracking-widest text-[#E8E4DC] transition-colors hover:bg-[#3C2A1A] clip-corner-sm"
                  >
                    {resultsLoading
                      ? 'Updating…'
                      : resultCount != null
                        ? `Show ${resultCount} fabric${resultCount === 1 ? '' : 's'}`
                        : 'View results'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )

  return createPortal(dock, document.body)
}

/* ————————————————————————————————————————————————————————————————
 * Active filter chips for the toolbar — lets people peel filters off
 * without reopening the drawer.
 * ———————————————————————————————————————————————————————————————— */

interface ActiveChip {
  key: string
  label: string
  onRemove: () => void
  swatch?: string
}

export function ActiveFilterChips({
  filters,
  onChange,
  categories = [],
  suppliers = [],
  className,
}: {
  filters: MarketplaceFilters
  onChange: (filters: MarketplaceFilters) => void
  categories?: FabricFilterOption[]
  suppliers?: FabricFilterOption[]
  className?: string
}) {
  const chips: ActiveChip[] = []

  if (filters.categorySlug) {
    const label =
      categories.find((c) => c.slug === filters.categorySlug)?.label ?? filters.categorySlug
    chips.push({
      key: 'category',
      label,
      onRemove: () => onChange({ ...filters, categorySlug: undefined }),
    })
  }
  if (filters.supplierSlug) {
    const label =
      suppliers.find((s) => s.slug === filters.supplierSlug)?.label ?? filters.supplierSlug
    chips.push({
      key: 'supplier',
      label,
      onRemove: () => onChange({ ...filters, supplierSlug: undefined }),
    })
  }
  for (const family of filters.colorFamilies ?? []) {
    chips.push({
      key: `color-${family}`,
      label: family,
      swatch: COLOR_SWATCHES[family],
      onRemove: () => {
        const next = (filters.colorFamilies ?? []).filter((f) => f !== family)
        onChange({ ...filters, colorFamilies: next.length > 0 ? next : undefined })
      },
    })
  }
  if (filters.priceMin != null || filters.priceMax != null) {
    chips.push({
      key: 'price',
      label: `PKR ${filters.priceMin ?? 0}–${filters.priceMax ?? '∞'}`,
      onRemove: () => onChange({ ...filters, priceMin: undefined, priceMax: undefined }),
    })
  }
  if (filters.gsmMin != null || filters.gsmMax != null) {
    chips.push({
      key: 'gsm',
      label: `GSM ${filters.gsmMin ?? 0}–${filters.gsmMax ?? '∞'}`,
      onRemove: () => onChange({ ...filters, gsmMin: undefined, gsmMax: undefined }),
    })
  }
  if (filters.search) {
    chips.push({
      key: 'search',
      label: `“${filters.search}”`,
      onRemove: () => onChange({ ...filters, search: undefined }),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <AnimatePresence initial={false}>
        {chips.map((chip) => (
          <motion.button
            key={chip.key}
            type="button"
            onClick={chip.onRemove}
            layout
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.18 }}
            className="group flex shrink-0 items-center gap-2 border border-[#2C1A0E]/25 bg-[#E8E4DC] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#2C1A0E] transition-colors hover:border-[#2C1A0E]"
            title="Remove filter"
          >
            {chip.swatch && (
              <span
                className="h-2.5 w-2.5 rounded-full border border-[#2C1A0E]/20"
                style={{ backgroundColor: chip.swatch }}
              />
            )}
            {chip.label}
            <X className="h-3 w-3 text-[#3C2A1A]/40 transition-colors group-hover:text-[#2C1A0E]" />
          </motion.button>
        ))}
      </AnimatePresence>
      {chips.length > 1 && (
        <button
          type="button"
          onClick={() => onChange({ sort: filters.sort })}
          className="shrink-0 px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-accent transition-colors hover:text-[#2C1A0E]"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

export default FilterDock
