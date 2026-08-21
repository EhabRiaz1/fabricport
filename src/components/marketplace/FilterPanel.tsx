import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COLOR_FAMILIES, type ColorFamily } from '@/lib/color/classify'
import { COLOR_SWATCH_HEX } from '@/lib/color/swatches'
import { Input } from '@/components/ui/input'
import type { FabricFilterOption, MarketplaceFilters } from '@/types/app'

export interface FilterPanelProps {
  filters: MarketplaceFilters
  onPatch: (next: Partial<MarketplaceFilters>) => void
  onToggleColor: (family: ColorFamily) => void
  onClearAll: () => void
  activeCount: number
  categories: FabricFilterOption[]
  suppliers: FabricFilterOption[]
  /** Published-fabric count per colour family; families at 0 are hidden. */
  colorCounts: Partial<Record<ColorFamily, number>>
  className?: string
}

/**
 * The marketplace facet rail.
 *
 * Replaces `FilterDock`, which rendered a bottom-centre pill and a bottom drawer at every
 * breakpoint. People did not notice it -- a bottom pill reads as a floating action button,
 * not as "the filters live here". This is a persistent left rail on desktop and the same
 * component inside a left `Sheet` on mobile.
 *
 * Written in the marketplace's hardcoded-hex palette rather than semantic tokens, because
 * the page around it is. (This is also why the dead `FilterSidebar.tsx` was not revived:
 * it was written in portal tokens and would have reintroduced that split.)
 */
export function FilterPanel({
  filters,
  onPatch,
  onToggleColor,
  onClearAll,
  activeCount,
  categories,
  suppliers,
  colorCounts,
  className,
}: FilterPanelProps) {
  const selectedColors = filters.colorFamilies ?? []
  // Families with no published fabric are noise, not information.
  const visibleColors = COLOR_FAMILIES.filter(
    (family) => (colorCounts[family] ?? 0) > 0 || selectedColors.includes(family),
  )

  return (
    <div className={cn('flex flex-col gap-7 text-[#2C1A0E]', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#9C8870]">
          Refine
        </p>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#E8593C] transition-opacity hover:opacity-70"
          >
            Clear {activeCount}
          </button>
        )}
      </div>

      <FacetGroup label="Category" open count={categories.length}>
        <ul className="flex flex-col">
          <FacetRow
            label="All fabrics"
            selected={!filters.categorySlug}
            onSelect={() => onPatch({ categorySlug: undefined })}
          />
          {categories.map((category) => (
            <FacetRow
              key={category.slug}
              label={category.label}
              count={category.count}
              selected={filters.categorySlug === category.slug}
              onSelect={() =>
                onPatch({
                  categorySlug:
                    filters.categorySlug === category.slug ? undefined : category.slug,
                })
              }
            />
          ))}
        </ul>
      </FacetGroup>

      <FacetGroup label="Colour" open count={visibleColors.length}>
        <div className="grid grid-cols-3 gap-2">
          {visibleColors.map((family) => {
            const active = selectedColors.includes(family)
            return (
              <button
                key={family}
                type="button"
                onClick={() => onToggleColor(family)}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-2 border px-2 py-1.5 text-left transition-colors',
                  active
                    ? 'border-[#E8593C] bg-[#E8593C]/8'
                    : 'border-[#C8C4BC] hover:border-[#9C8870]',
                )}
              >
                <span
                  aria-hidden
                  className="h-3 w-3 shrink-0 border border-[#2C1A0E]/15"
                  style={{ backgroundColor: COLOR_SWATCH_HEX[family] }}
                />
                <span className="truncate font-mono text-[9px] uppercase tracking-[0.12em]">
                  {family}
                </span>
              </button>
            )
          })}
        </div>
      </FacetGroup>

      <FacetGroup label="Price" open>
        <div className="flex items-center gap-2">
          <RangeInput
            label="Min PKR"
            value={filters.priceMin}
            onChange={(value) => onPatch({ priceMin: value })}
          />
          <span className="pt-4 text-[#9C8870]">–</span>
          <RangeInput
            label="Max PKR"
            value={filters.priceMax}
            onChange={(value) => onPatch({ priceMax: value })}
          />
        </div>
      </FacetGroup>

      {/* Collapsed by default once the list is long enough to dominate the rail. */}
      <FacetGroup label="Supplier" open={suppliers.length <= 8} count={suppliers.length}>
        <ul className="flex flex-col">
          <FacetRow
            label="All suppliers"
            selected={!filters.supplierSlug}
            onSelect={() => onPatch({ supplierSlug: undefined })}
          />
          {suppliers.map((supplier) => (
            <FacetRow
              key={supplier.slug}
              label={supplier.label}
              count={supplier.count}
              selected={filters.supplierSlug === supplier.slug}
              onSelect={() =>
                onPatch({
                  supplierSlug:
                    filters.supplierSlug === supplier.slug ? undefined : supplier.slug,
                })
              }
            />
          ))}
        </ul>
      </FacetGroup>

      <FacetGroup label="Weight (GSM)">
        <div className="flex items-center gap-2">
          <RangeInput
            label="Min"
            value={filters.gsmMin}
            onChange={(value) => onPatch({ gsmMin: value })}
          />
          <span className="pt-4 text-[#9C8870]">–</span>
          <RangeInput
            label="Max"
            value={filters.gsmMax}
            onChange={(value) => onPatch({ gsmMax: value })}
          />
        </div>
      </FacetGroup>
    </div>
  )
}

/**
 * Native <details>, so keyboard and screen-reader behaviour come for free and there is no
 * height animation to drop frames on.
 */
function FacetGroup({
  label,
  open,
  count,
  children,
}: {
  label: string
  open?: boolean
  count?: number
  children: React.ReactNode
}) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 border-b border-[#C8C4BC] pb-2 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#3C2A1A]">
          {label}
        </span>
        <span className="flex items-center gap-2 text-[#9C8870]">
          {count != null && (
            <span className="font-mono text-[9px] tabular-nums">{count}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  )
}

function FacetRow({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string
  count?: number
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'flex w-full items-center justify-between gap-3 py-1.5 text-left text-[13px] transition-colors',
          selected ? 'text-[#E8593C]' : 'text-[#3C2A1A] hover:text-[#2C1A0E]',
        )}
      >
        <span className="truncate">{label}</span>
        {count != null && (
          <span className="shrink-0 font-mono text-[9px] tabular-nums text-[#9C8870]">
            {count}
          </span>
        )}
      </button>
    </li>
  )
}

function RangeInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  return (
    <label className="flex-1">
      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-[#9C8870]">
        {label}
      </span>
      <Input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value
          onChange(raw === '' ? undefined : Number(raw))
        }}
        className="h-9 border-[#C8C4BC] bg-transparent text-[13px] text-[#2C1A0E]"
      />
    </label>
  )
}

export default FilterPanel
