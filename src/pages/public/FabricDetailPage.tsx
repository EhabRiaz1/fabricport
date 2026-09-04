import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  ChevronRight,
  Download,
  Palette as Swatch,
  Play,
  Send,
  ShoppingBag,
} from 'lucide-react'
import { PublicNav } from '@/components/layout/PublicNav'
import { Footer } from '@/components/layout/Footer'
import { FabricCard } from '@/components/marketplace/FabricCard'
import { ColorSwitcher } from '@/components/marketplace/ColorSwitcher'
import { WishlistButton } from '@/components/marketplace/WishlistButton'
import { ZoomImage } from '@/components/shared/ZoomImage'
import { ImageViewer } from '@/components/shared/ImageViewer'
import { SpecTable } from '@/components/shared/SpecTable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VerifiedBadge } from '@/components/ui/badge'
import { TestReportBadge } from '@/components/shared/TestReportBadge'
import { useProduct, useProducts } from '@/hooks/useProducts'
import { useAuth } from '@/contexts/AuthContext'
import { getFxRate, convertPrice } from '@/lib/fx'
import { createInquiry } from '@/lib/inquiries'
import { fetchOpenSampleProductIds } from '@/lib/samples'
import { SampleRequestDialog } from '@/components/marketplace/SampleRequestDialog'
import { dispatchNotification } from '@/lib/notifications'
import { trackSupplierView, usePagePresence } from '@/lib/track'
import {
  cn,
  formatPrice,
  getDigitalFabricName,
  getDigitalFabricUrl,
  getProductImageUrl,
  metersToYards,
} from '@/lib/utils'
import {
  getAvailability,
  getComposition,
  getConstruction,
  getFabricType,
  getGsmLabel,
  getPattern,
  getWeaveOrKnit,
  getWidth,
  PROMOTED_ATTRIBUTE_SLUGS,
} from '@/lib/product-specs'
import { usePreferencesStore } from '@/stores/preferences'
import { useCartStore } from '@/stores/cart'
import { useCartUI } from '@/lib/cart'
import { useChatDock } from '@/lib/chat-dock'
import { toast } from '@/stores/toast'
import type { ProductSpecRow } from '@/types/app'

export default function FabricDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { product, loading, error } = useProduct(slug)
  const { isAuthenticated, user, role } = useAuth()
  const { currency, unit } = usePreferencesStore()
  const [activeImage, setActiveImage] = useState(0)
  const [showVideo, setShowVideo] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)
  const addToCart = useCartStore((s) => s.add)
  const setCartOpen = useCartUI((s) => s.setOpen)
  const openThread = useChatDock((s) => s.openThread)
  const [quantity, setQuantity] = useState(1)
  const [fxRate, setFxRate] = useState(278)
  const [adding, setAdding] = useState(false)
  const [inquiring, setInquiring] = useState(false)
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false)
  const [sampleAlreadyRequested, setSampleAlreadyRequested] = useState(false)

  // Duplicate-request state: if this buyer already has a live request for this
  // fabric, the CTA flips to "Requested ✓" rather than silently creating another.
  useEffect(() => {
    if (!product?.id || !user?.id || role !== 'buyer') {
      setSampleAlreadyRequested(false)
      return
    }
    let cancelled = false
    fetchOpenSampleProductIds(user.id)
      .then((ids) => {
        if (!cancelled) setSampleAlreadyRequested(ids.has(product.id))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [product?.id, user?.id, role])

  // Related fabrics from the same supplier (excluding the current one).
  const { products: supplierProducts } = useProducts({
    supplierSlug: product?.supplier?.slug,
    limit: 5,
    enabled: Boolean(product?.supplier?.slug),
  })
  const relatedProducts = useMemo(
    () => supplierProducts.filter((p) => p.id !== product?.id).slice(0, 4),
    [supplierProducts, product?.id],
  )

  useEffect(() => {
    getFxRate().then(setFxRate).catch(() => undefined)
  }, [])

  useEffect(() => {
    setActiveImage(0)
    setShowVideo(false)
  }, [product?.id])

  // Product view event + live presence for supplier analytics.
  useEffect(() => {
    if (!product?.id || !product.supplier_id) return
    trackSupplierView({
      supplierId: product.supplier_id,
      productId: product.id,
    })
  }, [product?.id, product?.supplier_id])

  usePagePresence({
    path: `/fabric/${slug ?? ''}`,
    supplierId: product?.supplier_id,
  })

  const images = useMemo(
    () =>
      (product?.images ?? []).map((path) => ({
        card: getProductImageUrl(path, { variant: 'card' }),
        medium: getProductImageUrl(path, { variant: 'medium' }),
        large: getProductImageUrl(path, { variant: 'large' }),
        original: getProductImageUrl(path, { variant: 'original' }),
      })),
    [product?.images],
  )

  const specRows = useMemo<ProductSpecRow[]>(() => {
    if (!product) return []

    const minPkr = product.price_min_pkr ?? 0
    const maxPkr = product.price_max_pkr ?? minPkr
    const minUsd = product.price_min_usd ?? convertPrice(minPkr, 'PKR', 'USD', fxRate)
    const maxUsd = product.price_max_usd ?? convertPrice(maxPkr, 'PKR', 'USD', fxRate)
    const min = currency === 'USD' ? minUsd : minPkr
    const max = currency === 'USD' ? maxUsd : maxPkr
    const unitSuffix = unit === 'yards' ? '/yd' : '/m'
    const price =
      min === max || max === 0
        ? `${formatPrice(min, currency)}${unitSuffix}`
        : `${formatPrice(min, currency)} – ${formatPrice(max, currency)}${unitSuffix}`

    const stock =
      unit === 'yards'
        ? `${metersToYards(product.stock_meters).toFixed(0)} yards`
        : `${product.stock_meters.toFixed(0)} meters`

    /*
     * Every read goes through lib/product-specs, which prefers the promoted columns
     * (`gsm`, `width_inches`, `composition`, `spec_facets`) and falls back to the legacy
     * attribute table. Those attribute values are free text that may already carry a unit
     * ("301 GSM"), which is how "301 GSM GSM g/m²" happened -- so the helper prints them
     * as-is rather than appending a second unit.
     *
     * GSM shows both units ("185 g/m² · 5.45 oz"). The legacy site printed
     * "185 GSM | 5.45 Oz" and mills outside South Asia quote in ounces.
     */
    const widthText = getWidth(product)

    const rows: ProductSpecRow[] = [
      { label: 'GSM', value: getGsmLabel(product) ?? '—' },
      { label: 'WIDTH', value: widthText ? `${widthText}"` : '—' },
      { label: 'COMPOSITION', value: getComposition(product) ?? '—' },
      { label: 'CATEGORY', value: getFabricType(product) ?? '—' },
      { label: 'WEAVE / KNIT', value: getWeaveOrKnit(product) ?? '—' },
      { label: 'STOCK', value: stock },
      { label: 'MOQ', value: product.moq_meters ? `${product.moq_meters} m` : '—' },
      { label: 'LEAD TIME', value: product.lead_time_days ? `${product.lead_time_days} days` : '—' },
      { label: 'PRICE', value: price },
    ]

    // Optional rows, only when the mill provided them. Construction in particular is
    // "0x00x0" for 366 of the imported products, which the helper reports as absent.
    const pattern = getPattern(product)
    if (pattern) rows.push({ label: 'PATTERN', value: pattern })
    const construction = getConstruction(product)
    if (construction) rows.push({ label: 'CONSTRUCTION', value: construction })
    const availability = getAvailability(product)
    if (availability) rows.push({ label: 'AVAILABILITY', value: availability })

    // Surface every remaining technical attribute the mill provided -- finishes,
    // elongation, growth, recommended use.
    for (const attr of product.attributes ?? []) {
      if (!attr.attribute || PROMOTED_ATTRIBUTE_SLUGS.has(attr.attribute.slug)) continue
      const value =
        attr.value_text ?? (attr.value_number != null ? String(attr.value_number) : null)
      if (!value) continue
      rows.push({ label: attr.attribute.name.toUpperCase(), value })
    }

    return rows
  }, [product, currency, unit, fxRate])

  /** Mirrored from the legacy site's "Download Digital Fabric File"; null for most rows. */
  const digitalFabric = product?.scan_files?.[0] ?? null

  // The input is a bare <input> outside a <form>, so its `min` is never enforced.
  // Clamp here instead of trusting the field.
  const minQuantity = product?.moq_meters ?? 1
  const orderQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.max(quantity, minQuantity) : minQuantity

  /** Shared gate for both bulk CTAs. Returns false if it already redirected//toasted. */
  function ensureBuyer(): boolean {
    if (!isAuthenticated || !user) {
      navigate('/auth/login', { state: { from: `/fabric/${product?.slug ?? ''}` } })
      return false
    }
    // Without this a signed-in supplier/admin hits the cart_items / inquiries RLS
    // check and gets a raw Postgres error in a toast.
    if (role !== 'buyer') {
      toast.error('Buyer account required', 'Only buyer accounts can send inquiries.')
      return false
    }
    return true
  }

  async function handleAddToCart() {
    if (!product) return

    // Signed-out visitors get a local cart rather than a redirect. The store persists it and
    // CartSync folds it into cart_items on sign-in, so nobody loses a selection to a login.
    if (!isAuthenticated) {
      await addToCart(product, orderQuantity)
      setCartOpen(true)
      return
    }
    if (!ensureBuyer()) return

    setAdding(true)
    try {
      await addToCart(product, orderQuantity)
      setCartOpen(true)
    } catch (err) {
      toast.error('Could not add to cart', err instanceof Error ? err.message : 'Try again.')
    } finally {
      setAdding(false)
    }
  }

  function handleRequestSample() {
    if (!product || !ensureBuyer()) return
    setSampleDialogOpen(true)
  }

  /**
   * The immediate path: creates a real 1-item inquiry to this supplier and drops
   * the buyer into the thread, skipping the cart entirely. "Add to cart" remains
   * the batch path.
   */
  async function handleInquireNow() {
    if (!product?.supplier || !ensureBuyer()) return

    setInquiring(true)
    try {
      const inquiryId = await createInquiry({
        supplierId: product.supplier.id,
        lines: [{ product_id: product.id, quantity_meters: orderQuantity }],
      })

      dispatchNotification({
        userId: product.supplier.id,
        type: 'inquiry_received',
        title: 'New inquiry received',
        body: `A buyer sent an inquiry for ${product.title}.`,
        data: { inquiry_id: inquiryId },
      }).catch(() => undefined)

      toast.success('Inquiry sent', `${product.title} · ${orderQuantity} m`)
      // Open the conversation in the dock rather than navigating into the portal. The reader
      // asked a question about this fabric; taking them away from it to answer is backwards.
      openThread(
        inquiryId,
        product.supplier.brand_name,
        `Hi, I would like to know more about ${product.title}.`,
      )
    } catch (err) {
      toast.error(
        'Could not send inquiry',
        err instanceof Error ? err.message : 'Please try again.',
      )
    } finally {
      setInquiring(false)
    }
  }

  if (loading) {
    return (
      <>
        <PublicNav />
        <main className="mx-auto max-w-7xl px-6 pb-20 pt-24 lg:px-8">
          <Skeleton className="aspect-[16/9] w-full clip-corner" />
          <Skeleton className="mt-8 h-10 w-1/2" />
          <Skeleton className="mt-4 h-32 w-full" />
        </main>
      </>
    )
  }

  if (error || !product) {
    return (
      <>
        <PublicNav />
        <main className="mx-auto max-w-7xl px-6 pb-20 pt-24 text-center lg:px-8">
          <h1 className="font-display text-2xl font-semibold text-text-primary">
            Fabric not found
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {error ?? 'This fabric may have been removed or is not yet published.'}
          </p>
          <Button asChild className="mt-6">
            <Link to="/marketplace">Back to marketplace</Link>
          </Button>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-7xl px-6 pb-20 pt-24 lg:px-8">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-8 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted"
        >
          <Link to="/marketplace" className="transition-colors hover:text-accent">
            Marketplace
          </Link>
          {product.category && (
            <>
              <ChevronRight className="h-3 w-3" />
              <Link
                to={`/marketplace?category=${product.category.slug}`}
                className="transition-colors hover:text-accent"
              >
                {product.category.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-text-primary">{product.title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <div className="relative clip-corner overflow-hidden bg-surface">
              {showVideo && product.video_url ? (
                <video
                  src={product.video_url}
                  poster={images[0]?.medium}
                  controls
                  playsInline
                  className="aspect-square w-full bg-black object-cover"
                />
              ) : images[activeImage] ? (
                /*
                 * The srcSet here used to advertise `original` as 1920w. For 785 of the 1190
                 * stored objects that was simply false -- they were 240x300 -- so on a 2x
                 * display the browser confidently picked the worst file for the largest slot.
                 * Only the generated variants are listed now, because their widths are known
                 * by construction; `original` survives solely as an onError fallback.
                 */
                <ZoomImage
                  variants={images[activeImage]}
                  alt={product.title}
                  onOpenViewer={() => setViewerOpen(true)}
                />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-elevated">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    No image
                  </span>
                </div>
              )}
              <WishlistButton
                productId={product.id}
                className="absolute bottom-3 right-3 z-10"
              />
              <ImageViewer
                images={images}
                index={activeImage}
                open={viewerOpen}
                onOpenChange={setViewerOpen}
                onIndexChange={setActiveImage}
                alt={product.title}
              />
            </div>

            {/* The zoom affordance sits under the photo rather than on it — the magnifier
                chip used to cover the weave you were trying to read. Hidden on coarse
                pointers, where the panel never opens and a tap goes fullscreen instead.
                The underscores in the media variant are how Tailwind spells spaces inside
                an arbitrary variant; `and` without them is invalid CSS and the rule
                silently never applies. */}
            {images[activeImage] && !showVideo && (
              <p className="mt-2 hidden font-mono text-[9px] uppercase tracking-[0.22em] text-text-muted lg:[@media(hover:hover)_and_(pointer:fine)]:block">
                Hover to zoom · click for full size
              </p>
            )}

            {(images.length > 1 || product.video_url) && (
              <div className="mt-4 grid grid-cols-4 gap-3">
                {product.video_url && (
                  <button
                    type="button"
                    onClick={() => setShowVideo(true)}
                    aria-label="Play product video"
                    className={cn(
                      'relative clip-corner-sm overflow-hidden border-2 transition-colors',
                      showVideo ? 'border-accent' : 'border-border',
                    )}
                  >
                    {images[0] ? (
                      <img
                        src={images[0].card}
                        alt=""
                        className="aspect-square w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="aspect-square w-full bg-elevated" />
                    )}
                    <span className="absolute inset-0 grid place-items-center bg-black/30">
                      <Play className="h-6 w-6 fill-white text-white" />
                    </span>
                  </button>
                )}
                {images.map((image, index) => (
                  <button
                    key={image.medium}
                    type="button"
                    onClick={() => {
                      setShowVideo(false)
                      setActiveImage(index)
                    }}
                    className={cn(
                      'clip-corner-sm overflow-hidden border-2 transition-colors',
                      !showVideo && activeImage === index ? 'border-accent' : 'border-border',
                    )}
                  >
                    <img
                      src={image.card}
                      alt=""
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="clip-corner bg-card p-8 text-text-dark">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              {product.category?.name ?? 'Fabric'}
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              {product.title}
            </h1>

            {product.supplier && (
              <Link
                to={`/supplier/${product.supplier.slug}`}
                className="mt-3 inline-flex items-center gap-2 text-sm text-text-dark-secondary hover:text-accent"
              >
                {product.supplier.brand_name}
                {product.supplier.is_verified && <VerifiedBadge />}
              </Link>
            )}

            {product.test_report_status && (
              <div className="mt-4">
                <TestReportBadge status={product.test_report_status} />
              </div>
            )}

            {product.description && (
              <p className="mt-6 text-sm leading-relaxed text-text-dark-secondary">
                {product.description}
              </p>
            )}

            {(product.color_hex || product.color_display_name) && (
              <div className="mt-8 flex items-center gap-4 border-t border-border-cream pt-6">
                <span
                  className="h-10 w-10 border-2 border-border-cream shadow-sm"
                  style={{ backgroundColor: product.color_hex ?? '#808080' }}
                />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                    Color
                  </p>
                  {/* Both colour-name columns are null across the seeded catalog,
                      so this read "Unnamed" on every product page. Fall back to the
                      colour family, and only show the family as a second line when
                      it isn't already doing duty as the name. */}
                  <p className="text-sm font-medium capitalize">
                    {product.color_display_name ??
                      product.color_supplier_name ??
                      product.color_family ??
                      'Unnamed'}
                  </p>
                  {product.color_family &&
                    (product.color_display_name || product.color_supplier_name) && (
                      <p className="text-xs capitalize text-text-dark-secondary">
                        {product.color_family}
                      </p>
                    )}
                </div>
              </div>
            )}

            {/* Renders nothing unless this fabric has grouped siblings, so the
                block above is untouched for every standalone product. */}
            <ColorSwitcher
              fabricGroupId={product.fabric_group_id}
              currentProductId={product.id}
            />

            <div className="mt-8">
              <SpecTable rows={specRows} />
            </div>

            {/* Bulk block. The meters input belongs to these two CTAs only — a
                sample request is a single swatch and is not quantity-driven, so
                WS2's "Request sample" goes in its own row below, not here. */}
            <div className="mt-8 border-t border-border-cream pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label
                    htmlFor="quantity"
                    className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary"
                  >
                    Quantity (meters)
                  </label>
                  <input
                    id="quantity"
                    type="number"
                    min={minQuantity}
                    step={0.5}
                    value={quantity}
                    onChange={(event) => setQuantity(Number(event.target.value))}
                    className="mt-2 flex h-10 w-32 border border-border-cream bg-card px-3 text-sm text-text-dark"
                  />
                </div>

                <Button
                  onClick={handleInquireNow}
                  disabled={inquiring || adding || !product.supplier}
                  className="min-w-[160px]"
                >
                  <Send className="h-4 w-4" />
                  {inquiring ? 'Sending…' : 'Inquire now'}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleAddToCart}
                  disabled={adding || inquiring}
                  className="min-w-[160px]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {adding ? 'Adding…' : 'Add to cart'}
                </Button>
              </div>

              <p className="mt-3 text-xs text-text-dark-secondary">
                {product.moq_meters
                  ? `Minimum order ${product.moq_meters} m. `
                  : ''}
                Inquire now opens a conversation with this supplier straight away. Add to cart
                batches fabrics so you can send one inquiry per supplier later.
              </p>

              {/* Samples are single-swatch and not quantity-driven, so this sits
                  outside the bulk row with a distinct icon and a lighter weight. */}
              <div className="mt-4 border-t border-border-cream pt-4">
                <Button
                  variant="outline"
                  onClick={handleRequestSample}
                  disabled={sampleAlreadyRequested || !product.supplier}
                  className="min-w-[200px]"
                >
                  <Swatch className="h-4 w-4" />
                  {sampleAlreadyRequested ? 'Sample requested ✓' : 'Request a sample'}
                </Button>
                <p className="mt-2 text-xs text-text-dark-secondary">
                  {sampleAlreadyRequested
                    ? 'You already have an open request for this fabric.'
                    : 'A physical swatch posted to your address. No minimum.'}
                </p>
              </div>

              {/*
                * The digital counterpart to the physical swatch: a .zfab a designer drops
                * straight into CLO or Marvelous Designer. Carried over from the legacy
                * site, where it was the one thing our catalogue could not do.
                *
                * A plain <a download> rather than a Button: this is a file transfer, and
                * the browser should treat it as one (right-click "Save link as", middle
                * click, the download shelf).
                */}
              {digitalFabric && (
                <div className="mt-4 border-t border-border-cream pt-4">
                  <a
                    href={getDigitalFabricUrl(digitalFabric)}
                    download={getDigitalFabricName(digitalFabric)}
                    className="clip-corner-sm inline-flex min-w-[200px] items-center justify-center gap-2 border border-border-strong px-6 py-2.5 text-sm uppercase tracking-wider text-text-dark transition-colors hover:border-accent hover:text-accent"
                  >
                    <Box className="h-4 w-4" />
                    Download .zfab
                    <Download className="h-4 w-4" />
                  </a>
                  <p className="mt-2 text-xs text-text-dark-secondary">
                    Digital fabric file. Compatible with CLO 3D and Marvelous Designer.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* More from this supplier */}
        {relatedProducts.length > 0 && product.supplier && (
          <section className="mt-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">
                  More from this mill
                </p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-text-primary">
                  {product.supplier.brand_name}
                </h2>
              </div>
              <Link
                to={`/supplier/${product.supplier.slug}`}
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze transition-colors hover:text-accent"
              >
                Full catalogue →
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
              {relatedProducts.map((related) => (
                <FabricCard
                  key={related.id}
                  product={related}
                  variant="grid"
                  currency={currency}
                  unit={unit}
                  fxRate={fxRate}
                />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />

      {user && (
        <SampleRequestDialog
          open={sampleDialogOpen}
          onOpenChange={setSampleDialogOpen}
          product={product}
          buyerId={user.id}
          onSubmitted={(sampleRequestId) => {
            setSampleAlreadyRequested(true)
            toast.success('Sample requested', `${product.title} · swatch on its way`)
            navigate(`/buyer/samples/${sampleRequestId}`)
          }}
        />
      )}
    </>
  )
}
