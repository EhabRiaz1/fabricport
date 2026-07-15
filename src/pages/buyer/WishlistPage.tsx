import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { formatPrice, getProductImageUrl } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useWishlistStore } from '@/stores/wishlist'
import { usePreferencesStore } from '@/stores/preferences'
import { toast } from '@/stores/toast'
import type { ProductWithRelations } from '@/types/app'

const WISHLIST_SELECT = `
  *,
  supplier:suppliers(id, brand_name, slug, is_verified)
`

function priceLabel(product: ProductWithRelations, currency: 'PKR' | 'USD'): string {
  const min = currency === 'USD' ? product.price_min_usd : product.price_min_pkr
  const max = currency === 'USD' ? product.price_max_usd : product.price_max_pkr
  if (min == null || min === 0) return '—'
  if (max == null || max === min) return formatPrice(min, currency)
  return `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`
}

export default function WishlistPage() {
  const { user } = useAuth()
  const ids = useWishlistStore((s) => s.ids)
  const toggle = useWishlistStore((s) => s.toggle)
  const { currency } = usePreferencesStore()
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<ProductWithRelations | null>(null)

  const idsKey = useMemo(() => [...ids].sort().join(','), [ids])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (ids.length === 0) {
        setProducts([])
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('products')
        .select(WISHLIST_SELECT)
        .in('id', ids)
      if (cancelled) return
      if (error) console.error('Failed to load wishlist:', error.message)
      setProducts((data ?? []) as unknown as ProductWithRelations[])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  // Only show rows still in the wishlist (handles optimistic removal instantly).
  const visible = products.filter((p) => ids.includes(p.id))

  async function handleRemove(productId: string) {
    if (!user) return
    try {
      await toggle(user.id, productId)
      toast.success('Removed from wishlist')
      if (active?.id === productId) setActive(null)
    } catch {
      toast.error('Could not update wishlist')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Wishlist</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Saved Fabrics
        </h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-border bg-surface/40 py-16 text-center clip-corner">
          <Heart className="h-8 w-8 text-text-muted" />
          <p className="mt-3 text-sm text-text-secondary">
            You haven't saved any fabrics yet.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/marketplace">Browse the marketplace</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-border bg-surface/40 clip-corner">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-widest text-text-muted">
                <th className="px-4 py-3 font-medium">Fabric</th>
                <th className="px-4 py-3 font-medium">GSM</th>
                <th className="px-4 py-3 font-medium">Width</th>
                <th className="px-4 py-3 font-medium">Composition</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium">MOQ</th>
                <th className="px-4 py-3 font-medium">Lead time</th>
                <th className="px-4 py-3 font-medium sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => (
                <tr
                  key={product.id}
                  onClick={() => setActive(product)}
                  className="cursor-pointer border-b border-border/60 text-sm transition-colors last:border-0 hover:bg-surface"
                >
                  <td className="px-4 py-3">
                    <p className="font-display font-medium text-text-primary">{product.title}</p>
                    {product.supplier && (
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-text-muted">
                        {product.supplier.brand_name}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {product.gsm ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {product.width_inches ? `${product.width_inches}"` : '—'}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 font-mono text-xs text-text-secondary">
                    {product.composition ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {priceLabel(product, currency)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {product.stock_meters.toFixed(0)} m
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {product.moq_meters ? `${product.moq_meters} m` : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                    {product.lead_time_days ? `${product.lead_time_days} d` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleRemove(product.id)
                      }}
                      aria-label={`Remove ${product.title} from wishlist`}
                      className="text-text-muted transition-colors hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-xl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>{active.title}</DialogTitle>
              </DialogHeader>
              <div className="aspect-video w-full overflow-hidden bg-elevated clip-corner-sm">
                {active.images[0] ? (
                  <img
                    src={getProductImageUrl(active.images[0], { variant: 'medium' })}
                    alt={active.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    No image
                  </div>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-3 font-mono text-xs">
                {[
                  ['Supplier', active.supplier?.brand_name ?? '—'],
                  ['GSM', active.gsm ?? '—'],
                  ['Width', active.width_inches ? `${active.width_inches}"` : '—'],
                  ['Composition', active.composition ?? '—'],
                  ['Price', priceLabel(active, currency)],
                  ['Stock', `${active.stock_meters.toFixed(0)} m`],
                  ['MOQ', active.moq_meters ? `${active.moq_meters} m` : '—'],
                  ['Lead time', active.lead_time_days ? `${active.lead_time_days} d` : '—'],
                ].map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-[10px] uppercase tracking-widest text-text-muted">{label}</dt>
                    <dd className="mt-0.5 text-text-secondary">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="ghost"
                  className="text-danger hover:text-danger"
                  onClick={() => void handleRemove(active.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
                <Button asChild>
                  <Link to={`/fabric/${active.slug}`}>View fabric</Link>
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
