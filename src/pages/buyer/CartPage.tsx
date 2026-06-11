import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PackageOpen, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/hooks/useProfile'
import { dispatchNotification } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { formatPrice, getProductImageUrl } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { CartGroupBySupplier, CartItemWithProduct } from '@/types/app'

const PRODUCT_SELECT = `
  *,
  supplier:suppliers(*),
  category:fabric_categories(*)
`

function groupEstimate(group: CartGroupBySupplier): number {
  return group.items.reduce((sum, item) => {
    const unitPrice = item.product.price_min_pkr ?? 0
    return sum + unitPrice * item.quantity_meters
  }, 0)
}

export default function CartPage() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [items, setItems] = useState<CartItemWithProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const profileId = profile?.id

  const loadCart = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('cart_items')
      .select(`*, product:products(${PRODUCT_SELECT})`)
      .eq('buyer_id', profileId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setItems([])
    } else {
      setItems((data ?? []) as CartItemWithProduct[])
    }
    setLoading(false)
  }, [profileId])

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

  async function updateItem(
    id: string,
    patch: { quantity_meters?: number; notes?: string | null },
  ) {
    const { error: updateError } = await supabase.from('cart_items').update(patch).eq('id', id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  async function removeItem(id: string) {
    const { error: deleteError } = await supabase.from('cart_items').delete().eq('id', id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  async function submitAllInquiries() {
    if (!profile?.id || groups.length === 0) return
    setSubmitting(true)
    setError(null)

    try {
      for (const group of groups) {
        const { data: inquiry, error: inquiryError } = await supabase
          .from('inquiries')
          .insert({
            buyer_id: profile.id,
            supplier_id: group.supplier.id,
            status: 'open',
          })
          .select('id')
          .single()

        if (inquiryError) throw new Error(inquiryError.message)

        const inquiryItems = group.items.map((item) => ({
          inquiry_id: inquiry.id,
          product_id: item.product_id,
          quantity_meters: item.quantity_meters,
          notes: item.notes,
        }))

        const { error: itemsError } = await supabase.from('inquiry_items').insert(inquiryItems)
        if (itemsError) throw new Error(itemsError.message)

        const cartIds = group.items.map((item) => item.id)
        const { error: cartError } = await supabase.from('cart_items').delete().in('id', cartIds)
        if (cartError) throw new Error(cartError.message)

        // Server-side insert (RLS prevents cross-user inserts from the client);
        // the edge function also fans out to WhatsApp/email.
        dispatchNotification({
          userId: group.supplier.id,
          type: 'inquiry_received',
          title: 'New inquiry received',
          body: `${profile.company_name ?? profile.full_name ?? 'A buyer'} sent an inquiry for ${group.items.length} fabric${group.items.length === 1 ? '' : 's'}.`,
          data: { inquiry_id: inquiry.id },
        }).catch(() => undefined)
      }

      toast.success(
        groups.length === 1 ? 'Inquiry sent' : `${groups.length} inquiries sent`,
        'Suppliers have been notified and will respond in your inbox.',
      )
      navigate('/buyer/inquiries')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit inquiries')
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

      {groups.length === 0 ? (
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
