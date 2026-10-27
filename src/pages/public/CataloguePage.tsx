import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PackageOpen, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useChatDock } from '@/lib/chat-dock'
import { useFxRate, convertPkrToUsd } from '@/lib/fx'
import { dispatchNotification } from '@/lib/notifications'
import {
  getComposition,
  getGsmLabel,
  getGsmLabelShort,
  getWeaveOrKnit,
  getWidth,
} from '@/lib/product-specs'
import {
  PRICE_ON_REQUEST,
  clampQuantity,
  formatPrice,
  getProductImageUrl,
  quantityBounds,
  quantityIssue,
} from '@/lib/utils'
import { useProfile } from '@/hooks/useProfile'
import { usePreferencesStore } from '@/stores/preferences'
import { toast } from '@/stores/toast'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { SampleRequestDialog } from '@/components/marketplace/SampleRequestDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { ProductWithRelations } from '@/types/app'

interface CatalogueProduct {
  id: string
  title: string
  slug: string
  images: string[]
  visibility?: 'public' | 'private'
  gsm: number | null
  width_inches: number | null
  composition: string | null
  spec_facets?: Record<string, string> | null
  sample_available?: boolean
  price_approved?: boolean
  price_min_pkr: number | null
  price_max_pkr: number | null
  price_min_usd: number | null
  price_max_usd: number | null
  stock_meters: number
  moq_meters: number | null
  lead_time_days: number | null
  color_hex: string | null
  description?: string | null
  attributes?: {
    value_text: string | null
    value_number: number | null
    attribute: { slug: string; name: string; unit: string | null }
  }[]
}

interface Catalogue {
  id: string
  name: string
  /** `id` is returned from migration 20261027150000 on; older RPCs omit it. */
  supplier: { id?: string; brand_name: string; slug: string; is_verified: boolean }
  products: CatalogueProduct[]
}

/** The spec helpers read the same fields from a catalogue row as from a product row. */
function asProduct(p: CatalogueProduct): ProductWithRelations {
  return p as unknown as ProductWithRelations
}

/** Prices are only returned when approved; USD is always converted from PKR at the live rate. */
function priceLabel(p: CatalogueProduct, currency: 'PKR' | 'USD', rate: number | null): string {
  if (p.price_approved === false) return PRICE_ON_REQUEST
  const minPkr = p.price_min_pkr
  const maxPkr = p.price_max_pkr
  if (minPkr == null || minPkr === 0) return PRICE_ON_REQUEST
  const useUsd = currency === 'USD' && rate != null
  const fmt = (pkr: number) =>
    useUsd ? formatPrice(convertPkrToUsd(pkr, rate!), 'USD') : formatPrice(pkr, 'PKR')
  if (maxPkr == null || maxPkr === minPkr) return `${fmt(minPkr)} / m`
  return `${fmt(minPkr)} – ${fmt(maxPkr)} / m`
}

export default function CataloguePage() {
  const { token } = useParams<{ token: string }>()
  const { currency } = usePreferencesStore()
  const fxRate = useFxRate()
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<CatalogueProduct | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) return
      setLoading(true)
      const { data, error } = await supabase.rpc('get_catalogue', { p_token: token })
      if (cancelled) return
      setCatalogue(error || !data ? null : (data as unknown as Catalogue))
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Loading catalogue…
        </span>
      </div>
    )
  }

  if (!catalogue) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <BrandLogo imgClassName="brightness-0 opacity-85" />
        <p className="mt-4 font-display text-2xl font-semibold text-text-primary">
          This catalogue isn't available
        </p>
        <p className="max-w-md text-sm text-text-secondary">
          The link may have been closed by the supplier or has expired. If you were sent
          this by a supplier, please request an updated link.
        </p>
        <Link
          to="/marketplace"
          className="mt-2 font-mono text-[11px] uppercase tracking-widest text-accent hover:underline"
        >
          Browse the public marketplace →
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8">
          {/* The logo art is white; the cream header needs the dark treatment PublicNav uses. */}
          <BrandLogo imgClassName="brightness-0 opacity-85" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Private catalogue
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
          {catalogue.supplier.brand_name}
          {catalogue.supplier.is_verified && <span className="ml-1 text-accent">✓</span>}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-text-primary">
          {catalogue.name}
        </h1>

        {catalogue.products.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center border border-border bg-surface/40 py-16 text-center clip-corner">
            <PackageOpen className="h-8 w-8 text-text-muted" />
            <p className="mt-3 text-sm text-text-secondary">
              This catalogue doesn't have any fabrics yet.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catalogue.products.map((product) => (
              <article
                key={product.id}
                className="relative flex flex-col clip-corner clip-corner-accent bg-card text-text-dark transition-transform duration-200 focus-within:ring-2 focus-within:ring-accent hover:-translate-y-1"
              >
                <button
                  type="button"
                  onClick={() => setSelected(product)}
                  className="absolute inset-0 z-10 focus:outline-none"
                  aria-label={`View ${product.title}`}
                />
                <div className="relative aspect-square overflow-hidden bg-[#D8D4CC]">
                  {product.images[0] ? (
                    <img
                      src={getProductImageUrl(product.images[0], { variant: 'card' })}
                      // A single 480w file was being served into cells that are blurry at
                      // 2x. No magnifier here on purpose: a hover lens across a grid fights
                      // the card's own click-through.
                      srcSet={`${getProductImageUrl(product.images[0], { variant: 'card' })} 480w, ${getProductImageUrl(product.images[0], { variant: 'medium' })} 960w`}
                      sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
                      alt={product.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-mono text-[9px] uppercase tracking-widest text-text-dark-secondary/50">
                      No image
                    </div>
                  )}
                  {product.color_hex && (
                    <span
                      className="absolute bottom-2 left-2 h-5 w-5 border border-card shadow-sm"
                      style={{ backgroundColor: product.color_hex }}
                    />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-display text-sm font-semibold leading-tight">
                    {product.title}
                  </h3>
                  <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-text-dark-secondary">
                    <div>
                      <dt className="uppercase tracking-widest">GSM</dt>
                      <dd className="mt-0.5 truncate text-text-dark">
                        {getGsmLabelShort(asProduct(product)) ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-widest">Width</dt>
                      <dd className="mt-0.5 text-text-dark">
                        {getWidth(asProduct(product)) ? `${getWidth(asProduct(product))}"` : '—'}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="uppercase tracking-widest">Price</dt>
                      <dd className="mt-0.5 text-text-dark">
                        {priceLabel(product, currency, fxRate)}
                      </dd>
                    </div>
                  </dl>
                  {getComposition(asProduct(product)) && (
                    <p className="mt-3 line-clamp-2 font-mono text-[10px] text-text-dark-secondary">
                      {getComposition(asProduct(product))}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <CatalogueProductDialog
        product={selected}
        catalogue={catalogue}
        token={token ?? ''}
        currency={currency}
        fxRate={fxRate}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

function CatalogueProductDialog({
  product,
  catalogue,
  token,
  currency,
  fxRate,
  onClose,
}: {
  product: CatalogueProduct | null
  catalogue: Catalogue
  token: string
  currency: 'PKR' | 'USD'
  fxRate: number | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { user, isAuthenticated, role } = useProfile()
  const openThread = useChatDock((s) => s.openThread)
  const [quantityText, setQuantityText] = useState('')
  const [inquiring, setInquiring] = useState(false)
  const [sampleOpen, setSampleOpen] = useState(false)
  /** Private fabrics are only sampleable when the buyer can see the product row itself. */
  const [canSample, setCanSample] = useState(true)

  const bounds = quantityBounds(product ?? {})

  useEffect(() => {
    if (!product) return
    setQuantityText(String(quantityBounds(product).min))
    setCanSample(true)
    if (product.visibility === 'private' && user) {
      let cancelled = false
      supabase
        .from('products')
        .select('id')
        .eq('id', product.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setCanSample(!!data)
        })
      return () => {
        cancelled = true
      }
    }
  }, [product, user])

  if (!product) return null

  const supplierId = catalogue.supplier.id
  const spec = asProduct(product)
  const quantity = Number(quantityText)
  const problem = quantityIssue(quantity, bounds)
  const specs: [string, string | null][] = [
    ['Weight', getGsmLabel(spec)],
    ['Width', getWidth(spec) ? `${getWidth(spec)}"` : null],
    ['Composition', getComposition(spec)],
    ['Weave / knit', getWeaveOrKnit(spec)],
    ['MOQ', product.moq_meters ? `${product.moq_meters.toLocaleString('en-PK')} m` : null],
    ['In stock', product.stock_meters > 0 ? `${Math.floor(product.stock_meters).toLocaleString('en-PK')} m` : null],
    ['Lead time', product.lead_time_days ? `${product.lead_time_days} days` : null],
  ]
  const returnTo = `/c/${token}`

  function ensureBuyer(): boolean {
    if (!isAuthenticated || !user) {
      navigate('/auth/login', { state: { from: returnTo } })
      return false
    }
    if (role !== 'buyer') {
      toast.error('Buyer account required', 'Only buyer accounts can inquire or request samples.')
      return false
    }
    return true
  }

  async function inquire() {
    if (!product || !ensureBuyer() || inquiring) return
    if (problem) {
      toast.error('Check the quantity', problem)
      return
    }
    const qty = clampQuantity(quantity, bounds)
    setInquiring(true)
    // The share token is re-checked server-side: it is the buyer's proof of access to
    // a private fabric, which the ordinary create_inquiry visibility check does not know.
    const { data: inquiryId, error } = await supabase.rpc('create_catalogue_inquiry', {
      p_token: token,
      p_product_id: product.id,
      p_quantity_meters: qty,
      p_message: `Hi, I would like to know more about ${product.title} from your catalogue "${catalogue.name}". I am looking at ${qty.toLocaleString('en-PK')} m.`,
    })
    setInquiring(false)
    if (error || !inquiryId) {
      toast.error('Could not send inquiry', error?.message ?? 'Please try again.')
      return
    }
    if (supplierId) {
      dispatchNotification({
        userId: supplierId,
        type: 'inquiry_received',
        title: 'New inquiry received',
        body: `A buyer sent an inquiry for ${product.title}.`,
        data: { inquiry_id: inquiryId },
      }).catch(() => undefined)
    }
    toast.success('Inquiry sent', `${product.title} · ${qty.toLocaleString('en-PK')} m`)
    onClose()
    openThread(inquiryId, catalogue.supplier.brand_name)
  }

  function requestSample() {
    if (!ensureBuyer()) return
    setSampleOpen(true)
  }

  const sampleProduct = supplierId
    ? ({
        ...product,
        supplier_id: supplierId,
        supplier: { id: supplierId, brand_name: catalogue.supplier.brand_name },
      } as unknown as ProductWithRelations)
    : null

  return (
    <>
      <Dialog open={!sampleOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[92dvh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto bg-card p-0 text-text-dark sm:w-full">
          <div className="grid gap-0 md:grid-cols-2">
            <div className="aspect-square bg-[#D8D4CC]">
              {product.images[0] ? (
                <img
                  src={getProductImageUrl(product.images[0], { variant: 'medium' })}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-mono text-[9px] uppercase tracking-widest text-text-dark-secondary/50">
                  No image
                </div>
              )}
            </div>
            <div className="space-y-4 p-6">
              <DialogHeader className="pr-6 text-left">
                <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
                  {catalogue.supplier.brand_name}
                </p>
                <DialogTitle className="font-display text-xl text-text-dark">
                  {product.title}
                </DialogTitle>
                <DialogDescription className="font-display text-base font-semibold text-text-dark">
                  {priceLabel(product, currency, fxRate)}
                </DialogDescription>
              </DialogHeader>

              <dl className="divide-y divide-border-cream border-y border-border-cream text-sm">
                {specs
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-2">
                      <dt className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                        {label}
                      </dt>
                      <dd className="text-right text-text-dark">{value}</dd>
                    </div>
                  ))}
              </dl>

              {product.description && (
                <p className="whitespace-pre-line text-sm text-text-dark-secondary">
                  {product.description}
                </p>
              )}

              <div className="space-y-2">
                <label
                  htmlFor="catalogue-qty"
                  className="block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary"
                >
                  Quantity (m)
                </label>
                <Input
                  id="catalogue-qty"
                  type="number"
                  inputMode="numeric"
                  min={bounds.min}
                  max={bounds.max ?? undefined}
                  step={1}
                  value={quantityText}
                  onChange={(e) => setQuantityText(e.target.value)}
                  onBlur={() =>
                    setQuantityText(String(clampQuantity(Number(quantityText), bounds)))
                  }
                  aria-invalid={!!problem}
                  className="border-border-cream bg-card-hover text-text-dark"
                />
                {problem && <p className="text-xs text-danger">{problem}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={inquire} disabled={inquiring}>
                  <Send className="h-4 w-4" />
                  {inquiring ? 'Sending…' : 'Inquire'}
                </Button>
                {product.sample_available !== false && canSample && sampleProduct && (
                  <Button
                    variant="outline"
                    className="border-border-cream text-text-dark"
                    onClick={requestSample}
                  >
                    Request a sample
                  </Button>
                )}
              </div>
              {product.sample_available === false ? (
                <p className="text-xs text-text-dark-secondary">
                  Samples aren't offered for this fabric.
                </p>
              ) : (
                !canSample && (
                  <p className="text-xs text-text-dark-secondary">
                    Ask the mill about a sample in your inquiry.
                  </p>
                )
              )}
              {!isAuthenticated && (
                <p className="text-xs text-text-dark-secondary">
                  You'll be asked to sign in first and brought back here.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {user && sampleProduct && (
        <SampleRequestDialog
          open={sampleOpen}
          onOpenChange={setSampleOpen}
          product={sampleProduct}
          buyerId={user.id}
          onSubmitted={(sampleRequestId) => {
            setSampleOpen(false)
            onClose()
            toast.success('Sample requested', 'Waiting for the mill to accept')
            navigate(`/buyer/samples/${sampleRequestId}`)
          }}
        />
      )}
    </>
  )
}
