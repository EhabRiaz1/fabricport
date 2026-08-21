import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, PackageOpen, Plus, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useLenisLock } from '@/lib/lenis'
import { useCartStore } from '@/stores/cart'
import {
  useCartUI,
  groupBySupplier,
  groupEstimate,
  submitCartInquiries,
  unavailableItems,
} from '@/lib/cart'
import { usePreferencesStore } from '@/stores/preferences'
import { useAuth } from '@/contexts/AuthContext'
import { useProfile } from '@/hooks/useProfile'
import { getProductImageUrl, formatPrice, metersToYards } from '@/lib/utils'
import { convertPrice, getFxRate } from '@/lib/fx'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/utils'
import { useEffect } from 'react'

/**
 * Quick cart review from the nav.
 *
 * `/buyer/cart` stays the full workspace (roomy notes, the unavailable-item recovery
 * block); this is the glance-and-send surface. Both read the same store, so the nav badge
 * cannot go stale when someone edits on the page.
 */
export function CartDrawer() {
  const open = useCartUI((s) => s.open)
  const setOpen = useCartUI((s) => s.setOpen)
  const navigate = useNavigate()
  const { isAuthenticated, role } = useAuth()
  const { profile } = useProfile()
  const { currency, unit } = usePreferencesStore()
  const [fxRate, setFxRate] = useState(278)
  const [submitting, setSubmitting] = useState(false)

  const lines = useCartStore((s) => s.lines)
  const guestLines = useCartStore((s) => s.guestLines)
  const buyerId = useCartStore((s) => s.buyerId)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)
  const load = useCartStore((s) => s.load)

  // Lenis keeps its own scroll target, so without this the page lurches by a frame on close.
  useLenisLock(open)

  useEffect(() => {
    getFxRate().then(setFxRate).catch(() => undefined)
  }, [])

  const groups = useMemo(() => groupBySupplier(lines), [lines])
  // Rows whose supplier could not be resolved are not in any group, so without this they
  // would be counted in the header but rendered nowhere.
  const stranded = useMemo(() => unavailableItems(lines), [lines])
  const isGuest = !buyerId
  const isNonBuyer = isAuthenticated && role !== 'buyer'

  const totalPkr = useMemo(() => {
    if (isGuest) {
      return guestLines.reduce(
        (sum, l) => sum + (l.price_min_pkr ?? 0) * l.quantity_meters,
        0,
      )
    }
    return groups.reduce((sum, g) => sum + groupEstimate(g), 0)
  }, [isGuest, guestLines, groups])

  // Storage stays meters + PKR; only the display converts. CartPage hardcoded "Qty (m)" and
  // PKR and ignored the global unit toggle entirely.
  const showPrice = (pkr: number) =>
    formatPrice(currency === 'USD' ? convertPrice(pkr, 'PKR', 'USD', fxRate) : pkr, currency)
  const showQty = (meters: number) =>
    unit === 'yards' ? `${metersToYards(meters).toFixed(1)} yd` : `${meters} m`

  const itemCount = isGuest ? guestLines.length : lines.length

  async function handleSubmit() {
    if (!profile?.id || groups.length === 0) return
    setSubmitting(true)
    const result = await submitCartInquiries(profile, groups)
    setSubmitting(false)

    if (result.error) {
      toast.error('Could not send everything', result.error)
      await load(profile.id)
      return
    }
    toast.success(
      result.total === 1 ? 'Inquiry sent' : `${result.total} inquiries sent`,
      'Suppliers have been notified and will respond in your inbox.',
    )
    setOpen(false)
    navigate('/buyer/inquiries')
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[min(440px,100vw)] max-w-none bg-[#F6F1E9]">
        <SheetHeader className="border-[#C8C4BC] pr-12">
          <SheetTitle className="text-[#2C1A0E]">
            Inquiry cart{itemCount > 0 ? ` · ${itemCount}` : ''}
          </SheetTitle>
          <SheetDescription className="text-[#3C2A1A]/60">
            {/* The one thing nobody knows, and the reason "Submit" produces N confirmations. */}
            Grouped by supplier — each group becomes its own inquiry.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="px-0">
          {itemCount === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
              <PackageOpen className="h-8 w-8 text-[#9C8870]" />
              <p className="mt-4 font-display text-lg font-semibold tracking-tight text-[#2C1A0E]">
                No fabrics yet
              </p>
              <p className="mt-2 text-sm text-[#3C2A1A]/55">
                Add fabrics from the marketplace to batch an inquiry.
              </p>
              <Link
                to="/marketplace"
                onClick={() => setOpen(false)}
                className="mt-6 bg-[#2C1A0E] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#E8E4DC] transition-colors hover:bg-[#3C2A1A]"
              >
                Browse fabrics
              </Link>
            </div>
          ) : isGuest ? (
            <ul className="divide-y divide-[#C8C4BC]/60">
              {guestLines.map((line) => (
                <CartRow
                  key={line.product_id}
                  slug={line.slug}
                  title={line.title}
                  image={line.image}
                  supplierName={line.supplier_name}
                  unitPrice={line.price_min_pkr}
                  quantity={line.quantity_meters}
                  minQty={line.moq_meters ?? 1}
                  showPrice={showPrice}
                  showQty={showQty}
                  onQuantity={(q) => setQuantity(line.product_id, q)}
                  onRemove={() => remove(line.product_id)}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </ul>
          ) : (
            groups.map((group) => (
              <section key={group.supplier.id}>
                <div className="flex items-center justify-between gap-3 bg-[#EFE9DC] px-5 py-2">
                  <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[#3C2A1A]">
                    {group.supplier.brand_name}
                  </p>
                  <p className="shrink-0 font-mono text-[10px] tabular-nums text-[#3C2A1A]/60">
                    {showPrice(groupEstimate(group))}
                  </p>
                </div>
                <ul className="divide-y divide-[#C8C4BC]/60">
                  {group.items.map((item) => (
                    <CartRow
                      key={item.id}
                      slug={item.product.slug}
                      title={item.product.title}
                      image={item.product.images?.[0] ?? null}
                      supplierName={null}
                      unitPrice={item.product.price_min_pkr}
                      quantity={item.quantity_meters}
                      minQty={item.product.moq_meters ?? 1}
                      showPrice={showPrice}
                      showQty={showQty}
                      onQuantity={(q) => setQuantity(item.product_id, q)}
                      onRemove={() => remove(item.product_id)}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}

          {!isGuest && stranded.length > 0 && (
            <div className="mx-5 mt-4 border border-[#C8C4BC] bg-[#EFE9DC] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9C8870]">
                {stranded.length} unavailable
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[#3C2A1A]/65">
                {stranded.length === 1 ? 'One fabric is' : 'These fabrics are'} no longer
                offered by their supplier and cannot be sent.{' '}
                <Link
                  to="/buyer/cart"
                  onClick={() => setOpen(false)}
                  className="underline underline-offset-2 hover:text-[#2C1A0E]"
                >
                  Review in the full cart
                </Link>
                .
              </p>
            </div>
          )}
        </SheetBody>

        {itemCount > 0 && (
          <SheetFooter className="border-[#C8C4BC]">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#3C2A1A]/60">
                Estimated total
              </span>
              <span className="font-display text-lg font-semibold tracking-tight text-[#2C1A0E]">
                {showPrice(totalPkr)}
              </span>
            </div>

            {isGuest ? (
              <Link
                to="/auth/login"
                state={{ from: window.location.pathname }}
                onClick={() => setOpen(false)}
                className="mt-4 block w-full bg-[#2C1A0E] py-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[#E8E4DC] transition-colors hover:bg-[#3C2A1A]"
              >
                Sign in to send
              </Link>
            ) : isNonBuyer ? (
              <p className="mt-4 text-xs text-[#3C2A1A]/60">
                Inquiries can only be sent from a buyer account.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || groups.length === 0}
                className="mt-4 w-full bg-[#E8593C] py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white transition-colors hover:bg-[#C94A31] disabled:opacity-50"
              >
                {submitting
                  ? 'Sending…'
                  : `Submit ${groups.length} ${groups.length === 1 ? 'inquiry' : 'inquiries'}`}
              </button>
            )}

            <Link
              to="/buyer/cart"
              onClick={() => setOpen(false)}
              className="mt-3 block text-center font-mono text-[10px] uppercase tracking-[0.14em] text-[#3C2A1A]/55 transition-colors hover:text-[#2C1A0E]"
            >
              View full cart
            </Link>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

function CartRow({
  slug,
  title,
  image,
  supplierName,
  unitPrice,
  quantity,
  minQty,
  showPrice,
  showQty,
  onQuantity,
  onRemove,
  onNavigate,
}: {
  slug: string
  title: string
  image: string | null
  supplierName: string | null
  unitPrice: number | null
  quantity: number
  minQty: number
  showPrice: (pkr: number) => string
  showQty: (meters: number) => string
  onQuantity: (quantity: number) => void
  onRemove: () => void
  onNavigate: () => void
}) {
  const step = (delta: number) => onQuantity(Math.max(minQty, quantity + delta))

  return (
    <li className="flex gap-3 px-5 py-4">
      <Link
        to={`/fabric/${slug}`}
        onClick={onNavigate}
        className="h-14 w-14 shrink-0 overflow-hidden bg-[#E8E2D2]"
      >
        {image && (
          <img
            src={getProductImageUrl(image, { variant: 'card' })}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to={`/fabric/${slug}`}
          onClick={onNavigate}
          className="block truncate text-[13px] font-medium text-[#2C1A0E] hover:text-[#E8593C]"
        >
          {title}
        </Link>
        {supplierName && (
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-[#9C8870]">
            {supplierName}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center border border-[#C8C4BC]">
            <button
              type="button"
              onClick={() => step(-Math.max(1, minQty))}
              aria-label="Decrease quantity"
              disabled={quantity <= minQty}
              className="grid h-7 w-7 place-items-center text-[#3C2A1A] transition-colors hover:bg-[#E8E2D2] disabled:opacity-30"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="min-w-14 px-2 text-center font-mono text-[10px] tabular-nums text-[#2C1A0E]">
              {showQty(quantity)}
            </span>
            <button
              type="button"
              onClick={() => step(Math.max(1, minQty))}
              aria-label="Increase quantity"
              className="grid h-7 w-7 place-items-center text-[#3C2A1A] transition-colors hover:bg-[#E8E2D2]"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {unitPrice != null && (
            <span className="font-mono text-[10px] tabular-nums text-[#3C2A1A]/60">
              {showPrice(unitPrice * quantity)}
            </span>
          )}

          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${title}`}
            className={cn(
              'ml-auto grid h-7 w-7 place-items-center text-[#9C8870]',
              'transition-colors hover:text-[#C2382A]',
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  )
}

export default CartDrawer
