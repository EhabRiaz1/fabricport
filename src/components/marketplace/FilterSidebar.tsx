import { cn } from '@/lib/utils'
import { COLOR_FAMILIES } from '@/lib/color/classify'
import type { ColorFamily } from '@/lib/color/classify'
import type { FabricFilterOption, MarketplaceFilters } from '@/types/app'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

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

export interface FilterSidebarProps {
  filters: MarketplaceFilters
  onChange: (filters: MarketplaceFilters) => void
  categories?: FabricFilterOption[]
  suppliers?: FabricFilterOption[]
  className?: string
}

export function FilterSidebar({
  filters,
  onChange,
  categories = [],
  suppliers = [],
  className,
}: FilterSidebarProps) {
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

  return (
    <aside className={cn('space-y-8', className)}>
      <div>
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Filters
        </h3>
      </div>

      {categories.length > 0 && (
        <div className="space-y-3">
          <Label>Category</Label>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => update({ categorySlug: undefined })}
              className={cn(
                'block w-full px-2 py-1.5 text-left text-sm transition-colors hover:text-accent',
                !filters.categorySlug ? 'text-accent' : 'text-text-secondary',
              )}
            >
              All categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => update({ categorySlug: cat.slug })}
                className={cn(
                  'flex w-full items-center justify-between px-2 py-1.5 text-left text-sm transition-colors hover:text-accent',
                  filters.categorySlug === cat.slug ? 'text-accent' : 'text-text-secondary',
                )}
              >
                <span>{cat.label}</span>
                {cat.count != null && (
                  <span className="font-mono text-[10px] text-text-muted">{cat.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <Label>Color Family</Label>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_FAMILIES.map((family) => {
            const selected = filters.colorFamilies?.includes(family)
            return (
              <button
                key={family}
                type="button"
                onClick={() => toggleColorFamily(family)}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 text-left text-xs capitalize transition-colors',
                  selected ? 'text-accent' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <span
                  className={cn(
                    'h-3 w-3 shrink-0 border',
                    selected ? 'border-accent' : 'border-border',
                  )}
                  style={{ backgroundColor: COLOR_SWATCHES[family] }}
                />
                {family}
              </button>
            )
          })}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>Price Range (PKR)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.priceMin ?? ''}
            onChange={(e) =>
              update({
                priceMin: e.target.value ? Number(e.target.value) : undefined,
              })
            }
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
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <Label>GSM Range</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={filters.gsmMin ?? ''}
            onChange={(e) =>
              update({
                gsmMin: e.target.value ? Number(e.target.value) : undefined,
              })
            }
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
          />
        </div>
      </div>

      {suppliers.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label>Supplier</Label>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => update({ supplierSlug: undefined })}
                className={cn(
                  'block w-full px-2 py-1.5 text-left text-sm transition-colors hover:text-accent',
                  !filters.supplierSlug ? 'text-accent' : 'text-text-secondary',
                )}
              >
                All suppliers
              </button>
              {suppliers.map((supplier) => (
                <button
                  key={supplier.slug}
                  type="button"
                  onClick={() => update({ supplierSlug: supplier.slug })}
                  className={cn(
                    'flex w-full items-center justify-between px-2 py-1.5 text-left text-sm transition-colors hover:text-accent',
                    filters.supplierSlug === supplier.slug
                      ? 'text-accent'
                      : 'text-text-secondary',
                  )}
                >
                  <span>{supplier.label}</span>
                  {supplier.count != null && (
                    <span className="font-mono text-[10px] text-text-muted">
                      {supplier.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </aside>
  )
}

export default FilterSidebar
