import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COLOR_SWATCH_HEX } from '@/lib/color/swatches'
import type { FabricFilterOption, MarketplaceFilters } from '@/types/app'

/**
 * Peel-off chips for the active facets.
 *
 * Lifted verbatim out of FilterDock (now deleted) so the toolbar keeps this affordance
 * independently of how the facets themselves are presented.
 */

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
      swatch: COLOR_SWATCH_HEX[family],
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

export default ActiveFilterChips
