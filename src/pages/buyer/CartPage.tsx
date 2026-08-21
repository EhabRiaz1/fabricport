import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PackageOpen, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/hooks/useProfile'
import { useCartStore } from '@/stores/cart'
import { createInquiry } from '@/lib/inquiries'
import { dispatchNotification } from '@/lib/notifications'
import { formatPrice, getProductImageUrl } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { CartGroupBySupplier } from '@/types/app'

function groupEstimate(group: CartGroupBySupplier): number {
  return group.items.reduce((sum, item) => {
    const unitPrice = item.product.price_min_pkr ?? 0
    return sum + unitPrice * item.quantity_meters
  }, 0)
}

export default function CartPage() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  /**
   * Reads from the shared cart store rather than its own fetch.
   *
   * Two sources of truth meant the nav badge went stale the moment someone edited here.
   * `load()` deliberately keeps rows whose product.supplier is null so the "unavailable
   * items" recovery block below still has something to show.
   */
  const items = useCartStore((s) => s.lines)
  const storeLoading = useCartStore((s) => s.loading)
  const storeLoaded = useCartStore((s) => s.loaded)
  const load = useCartStore((s) => s.load)
  const storeSetQuantity = useCartStore((s) => s.setQuantity)
  const storeSetNotes = useCartStore((s) => s.setNotes)
  const storeRemove = useCartStore((s) => s.remove)
  const loading = storeLoading || !storeLoaded
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const profileId = profile?.id

  const loadCart = useCallback(async () => {
    if (!profileId) return
    await load(profileId)
  }, [profileId, load])

  useEffect(() => {
    loadCart()
  }, [loadCart])

  const groups = useMemo<CartGroupBySupplier[]>(() => {
    const map = new Map<string, CartGroupBySupplier>()
    for (const item of items) {
      const supplier = item.product.supplier
      if (!supplier) continue
      const existing = map.get(supplier.id)
      if (existing) {
        existing.items.push(item)
      } else {
        map.set(supplier.id, { supplier, items: [item] })
      }
    }
    return Array.from(map.values())
  }, [items])

  const totalEstimate = useMemo(
    () => groups.reduce((sum, group) => sum + groupEstimate(group), 0),
    [groups],
  )

  // Rows whose supplier can't be resolved (supplier removed, or the product is no
  // longer visible under RLS) are skipped by `groups`. They used to vanish silently:
  // never submitted, never deleted, invisible in the UI, stuck in the cart forever.
  const unavailableItems = useMemo(() => items.filter((item) => !item.product?.supplier), [items])

  // Writes go through the store so the nav badge and the drawer stay in step. The store
  // is keyed on product_id; this page still identifies rows by cart_item id.
  async function updateItem(
    id: string,
    patch: { quantity_meters?: number; notes?: string | null },
  ) {
    const row = items.find((item) => item.id === id)
    if (!row) return
    try {
      if (patch.quantity_meters != null) {
        await storeSetQuantity(row.product_id, patch.quantity_meters)
      }
      if (patch.notes !== undefined) {
        await storeSetNotes(row.product_id, patch.notes ?? '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the cart')
    }
  }

  async function removeItem(id: string) {
    const row = items.find((item) => item.id === id)
    if (!row) return
    try {
      await storeRemove(row.product_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the item')
    }
  }

  async function submitAllInquiries() {
    if (!profile?.id || groups.length === 0) return
    setSubmitting(true)
    setError(null)

    let sent = 0
    try {
      for (const group of groups) {
        // One RPC == one transaction: the inquiry, its items and the cart cleanup
        // either all land or none do. Buyers have no DELETE policy on `inquiries`,
        // so a client-side multi-step version cannot clean up after itself.
        const inquiryId = await createInquiry({
          supplierId: group.supplier.id,
          lines: group.items.map((item) => ({
            product_id: item.product_id,
            quantity_meters: item.quantity_meters,
            notes: item.notes,
          })),
          cartItemIds: group.items.map((item) => item.id),
        })
        sent += 1

        // Fan-out only (WhatsApp/email). The inquiry itself is already committed.
        dispatchNotification({
          userId: group.supplier.id,
          type: 'inquiry_received',
          title: 'New inquiry received',
          body: `${profile.company_name ?? profile.full_name ?? 'A buyer'} sent an inquiry for ${group.items.length} fabric${group.items.length === 1 ? '' : 's'}.`,
          data: { inquiry_id: inquiryId },
        }).catch(() => undefined)
      }

      toast.success(
        groups.length === 1 ? 'Inquiry sent' : `${groups.length} inquiries sent`,
        'Suppliers have been notified and will respond in your inbox.',
      )
      navigate('/buyer/inquiries')
    } catch (err) {
      // Each group is its own transaction, so an earlier group may have committed.
      // Re-read the cart rather than leaving the list showing already-sent items.
      setError(
        `${err instanceof Error ? err.message : 'Failed to submit inquiries'}${
          sent > 0 ? ` (${sent} of ${groups.length} inquiries were sent)` : ''
        }`,
      )
      await loadCart()
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Cart</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Inquiry Cart
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Items are grouped by supplier — each group becomes a separate inquiry.
          </p>
        </div>
        {groups.length > 0 && (
          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-muted">
                Estimated value
              </p>
              <p className="font-display text-lg font-semibold text-text-primary">
                {formatPrice(totalEstimate, 'PKR')}
              </p>
            </div>
            <Button onClick={submitAllInquiries} disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting…' : 'Submit All Inquiries'}
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      {unavailableItems.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-text-dark">
                {unavailableItems.length} item{unavailableItems.length === 1 ? '' : 's'} can no
                longer be ordered
              </p>
              <p className="mt-1 text-sm text-text-dark-secondary">
                The supplier is no longer available. These items can't be included in an inquiry.
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => unavailableItems.forEach((item) => removeItem(item.id))}
            >
              <Trash2 className="h-4 w-4" />
              Remove {unavailableItems.length === 1 ? 'it' : 'them'}
            </Button>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 && unavailableItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <PackageOpen className="mx-auto h-10 w-10 text-text-muted" />
            <p className="mt-4 text-text-dark-secondary">Your cart is empty.</p>
            <Button asChild className="mt-5" variant="outline">
              <Link to="/marketplace">Browse Marketplace</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.supplier.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-text-dark">{group.supplier.brand_name}</CardTitle>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dark-secondary">
                {group.items.length} item{group.items.length === 1 ? '' : 's'} · est.{' '}
                {formatPrice(groupEstimate(group), 'PKR')}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-4 border border-border-cream bg-card-hover p-4 lg:grid-cols-[72px_1fr_120px_1fr_auto]"
                >
                  <Link
                    to={`/fabric/${item.product.slug}`}
                    className="clip-corner-sm hidden h-[72px] w-[72px] overflow-hidden bg-elevated lg:block"
                  >
                    {item.product.images?.[0] && (
                      <img
                        src={getProductImageUrl(item.product.images[0], { variant: 'card' })}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </Link>
                  <div>
                    <Link
                      to={`/fabric/${item.product.slug}`}
                      className="font-medium text-text-dark hover:text-accent"
                    >
                      {item.product.title}
                    </Link>
                    {item.product.color_display_name && (
                      <p className="mt-1 text-xs text-text-dark-secondary">
                        {item.product.color_display_name}
                      </p>
                    )}
                    {item.product.price_min_pkr != null && (
                      <p className="mt-1 font-mono text-[10px] text-text-dark-secondary">
                        {formatPrice(item.product.price_min_pkr, 'PKR')}/m
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                      Qty (m)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity_meters}
                      onChange={(e) =>
                        updateItem(item.id, {
                          quantity_meters: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className="border-border-cream bg-card text-text-dark"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                      Notes
                    </label>
                    <Textarea
                      value={item.notes ?? ''}
                      onChange={(e) => updateItem(item.id, { notes: e.target.value || null })}
                      placeholder="Optional notes for this item"
                      className="min-h-[40px] border-border-cream bg-card text-text-dark"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                    className="self-start text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
