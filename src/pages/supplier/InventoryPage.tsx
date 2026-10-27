import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, List, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/badge'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { cn, getProductImageUrl } from '@/lib/utils'
import { usePreferencesStore, type InventoryView } from '@/stores/preferences'
import { InventoryGridCard } from '@/pages/supplier/components/InventoryGridCard'
import {
  draftFromProduct,
  INVENTORY_PRODUCT_SELECT,
  NumberField,
  ProductEditDialog,
  saveProductDraft,
  useWeaveAttribute,
  validateDraft,
  type ProductDraft,
} from '@/pages/supplier/components/ProductEditDialog'
import { getComposition, getGsmLabelShort, getWidth } from '@/lib/product-specs'
import type { ProductWithRelations } from '@/types/app'
import type { ProductVisibility } from '@/types/database.types'

const VIEW_OPTIONS: { value: InventoryView; label: string; Icon: typeof LayoutGrid }[] = [
  { value: 'grid', label: 'Grid', Icon: LayoutGrid },
  { value: 'list', label: 'List', Icon: List },
]

/**
 * The supplier's own catalogue.
 *
 * Two shells over the same data. **Grid** is the default and mirrors the marketplace, so a
 * supplier sees their listings the way buyers do and can take in a whole page at a glance;
 * editing happens in a dialog. **List** is the original stacked form, kept because editing
 * ten fabrics in a row is genuinely faster with every field already on screen.
 */
export default function SupplierInventoryPage() {
  const { profile } = useProfile()
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, ProductDraft>>({})
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<ProductWithRelations | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showErrorsFor, setShowErrorsFor] = useState<Set<string>>(() => new Set())
  const weaveAttr = useWeaveAttribute()
  const view = usePreferencesStore((s) => s.inventoryView)
  const setView = usePreferencesStore((s) => s.setInventoryView)

  const profileId = profile?.id

  const loadProducts = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select(INVENTORY_PRODUCT_SELECT)
      .eq('supplier_id', profileId)
      // Stable order: sorting by updated_at made a fabric jump to the top every time
      // it was saved, so the row being edited moved out from under the cursor.
      .order('title', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    if (error) setLoadError(error.message)
    const list = (data ?? []) as ProductWithRelations[]
    setProducts(list)
    setDrafts(Object.fromEntries(list.map((p) => [p.id, draftFromProduct(p)])))
    setLoading(false)
  }, [profileId])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  /** Swap one saved row into the list in place -- no refetch, no skeleton flash. */
  function replaceProduct(saved: ProductWithRelations) {
    setProducts((prev) => prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)))
    setDrafts((prev) => ({ ...prev, [saved.id]: draftFromProduct(saved) }))
  }

  async function saveProduct(product: ProductWithRelations) {
    const draft = drafts[product.id]
    if (!draft || savingId) return
    if (Object.keys(validateDraft(draft)).length > 0) {
      setShowErrorsFor((prev) => new Set(prev).add(product.id))
      return
    }

    setSavingId(product.id)
    const saved = await saveProductDraft(product, draft, weaveAttr?.id)
    if (saved) {
      replaceProduct(saved)
      setShowErrorsFor((prev) => {
        const next = new Set(prev)
        next.delete(product.id)
        return next
      })
    }
    setSavingId(null)
  }

  function updateDraft(productId: string, patch: Partial<ProductDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], ...patch },
    }))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const visibleProducts = search.trim()
    ? products.filter((p) => p.title.toLowerCase().includes(search.trim().toLowerCase()))
    : products

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Inventory</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Product Catalogue
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {products.length} fabric{products.length === 1 ? '' : 's'} listed
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center border border-border">
            {VIEW_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                aria-pressed={view === value}
                title={`${label} view`}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                  'focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent',
                  view === value
                    ? 'bg-text-primary text-background'
                    : 'text-text-secondary hover:bg-elevated hover:text-text-primary',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              type="search"
              placeholder="Search your fabrics…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-border bg-surface pl-9 text-text-primary"
            />
          </div>
        </div>
      </div>

      {loadError && <p className="text-sm text-danger">Could not load your fabrics: {loadError}</p>}

      {visibleProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-text-dark-secondary">
            {products.length === 0
              ? 'No products in your catalogue yet.'
              : 'No fabrics match your search.'}
          </CardContent>
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleProducts.map((product) => (
            <InventoryGridCard key={product.id} product={product} onEdit={setEditing} />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {visibleProducts.map((product) => (
            <Card key={product.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-start gap-4">
                  <Link
                    to={`/fabric/${product.slug}`}
                    // Matches the grid card's "view live listing" button: checking the
                    // public page should not throw away half-typed edits on this one.
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${product.title} on the marketplace — opens in a new tab`}
                    className="clip-corner-sm block h-14 w-14 shrink-0 overflow-hidden bg-elevated"
                  >
                    {product.images?.[0] && (
                      <img
                        src={getProductImageUrl(product.images[0], { variant: 'card' })}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </Link>
                  <div>
                    <CardTitle className="text-text-dark">{product.title}</CardTitle>
                    <p className="mt-1 text-xs text-text-dark-secondary">
                      {product.category?.name ?? 'Uncategorized'}
                    </p>
                    <SpecLine product={product} />
                  </div>
                </div>
                <StatusBadge status={product.status} />
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const draft = drafts[product.id]
                  const errors =
                    draft && showErrorsFor.has(product.id) ? validateDraft(draft) : {}
                  return (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                      <NumberField
                        label="Stock (m)"
                        value={draft?.stock ?? ''}
                        error={errors.stock}
                        onChange={(v) => updateDraft(product.id, { stock: v })}
                      />
                      <NumberField
                        label="Min Price PKR"
                        value={draft?.priceMin ?? ''}
                        error={errors.priceMin}
                        onChange={(v) => updateDraft(product.id, { priceMin: v })}
                      />
                      <NumberField
                        label="Max Price PKR"
                        value={draft?.priceMax ?? ''}
                        error={errors.priceMax}
                        onChange={(v) => updateDraft(product.id, { priceMax: v })}
                      />
                      <NumberField
                        label="MOQ (m)"
                        value={draft?.moq ?? ''}
                        error={errors.moq}
                        onChange={(v) => updateDraft(product.id, { moq: v })}
                      />
                      <NumberField
                        label="Lead time (days)"
                        value={draft?.leadTime ?? ''}
                        error={errors.leadTime}
                        onChange={(v) => updateDraft(product.id, { leadTime: v })}
                      />
                    </div>
                  )
                })()}

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                      Visibility
                    </label>
                    <select
                      value={drafts[product.id]?.visibility ?? 'public'}
                      onChange={(e) =>
                        updateDraft(product.id, { visibility: e.target.value as ProductVisibility })
                      }
                      className="h-10 w-full border border-border-cream bg-card-hover px-3 text-sm text-text-dark"
                    >
                      <option value="public">Public — visible to everyone</option>
                      <option value="private">Private — share by link only</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-text-dark">
                      <input
                        type="checkbox"
                        checked={drafts[product.id]?.sampleAvailable ?? false}
                        onChange={(e) =>
                          updateDraft(product.id, { sampleAvailable: e.target.checked })
                        }
                        className="h-4 w-4 accent-accent"
                      />
                      Sample available
                    </label>
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-text-dark">
                      <input
                        type="checkbox"
                        checked={drafts[product.id]?.running ?? false}
                        onChange={(e) => updateDraft(product.id, { running: e.target.checked })}
                        className="h-4 w-4 accent-accent"
                      />
                      Running fabric
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                    Description
                  </label>
                  <Textarea
                    value={drafts[product.id]?.description ?? ''}
                    onChange={(e) => updateDraft(product.id, { description: e.target.value })}
                    placeholder="Fabric details buyers should know…"
                    className="min-h-[70px] border-border-cream bg-card-hover text-text-dark"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  {!product.price_approved && product.price_min_pkr != null ? (
                    <p className="text-xs text-warning">Price pending admin approval</p>
                  ) : (
                    <span />
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      className="text-text-dark"
                      onClick={() => setEditing(product)}
                      disabled={savingId === product.id}
                    >
                      Specs &amp; all fields
                    </Button>
                    <Button
                      onClick={() => saveProduct(product)}
                      disabled={savingId === product.id}
                    >
                      {savingId === product.id ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProductEditDialog
        product={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onSaved={replaceProduct}
      />
    </div>
  )
}

/** "185 g · 5.5 oz · 58" · 100% Cotton", from the promoted columns or the attribute fallback. */
function SpecLine({ product }: { product: ProductWithRelations }) {
  const gsm = getGsmLabelShort(product)
  const width = getWidth(product)
  const composition = getComposition(product)
  const parts = [gsm, width ? `${width}"` : null, composition].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
      {parts.join(' · ')}
    </p>
  )
}
