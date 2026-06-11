import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, ShoppingBag } from 'lucide-react'
import { PublicNav } from '@/components/layout/PublicNav'
import { Footer } from '@/components/layout/Footer'
import { FabricCard } from '@/components/marketplace/FabricCard'
import { SpecTable } from '@/components/shared/SpecTable'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VerifiedBadge } from '@/components/ui/badge'
import { useProduct, useProducts } from '@/hooks/useProducts'
import { useAuth } from '@/contexts/AuthContext'
import { getFxRate, convertPrice } from '@/lib/fx'
import { trackSupplierView, usePagePresence } from '@/lib/track'
import { supabase } from '@/lib/supabase'
import {
  cn,
  formatPrice,
  getProductImageUrl,
  metersToYards,
} from '@/lib/utils'
import { usePreferencesStore } from '@/stores/preferences'
import { toast } from '@/stores/toast'
import type { ProductSpecRow } from '@/types/app'

function getAttributeValue(
  product: NonNullable<ReturnType<typeof useProduct>['product']>,
  slug: string,
): string | null {
  const match = product.attributes?.find((attr) => attr.attribute?.slug === slug)
  if (!match) return null
  if (match.value_text) return match.value_text
  if (match.value_number != null) return String(match.value_number)
  return null
}

export default function FabricDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { product, loading, error } = useProduct(slug)
  const { isAuthenticated, user } = useAuth()
  const { currency, unit } = usePreferencesStore()
  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [fxRate, setFxRate] = useState(278)
  const [adding, setAdding] = useState(false)

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
  }, [product?.id])

  // Product view event + live presence for supplier analytics.
  useEffect(() => {
    if (!product?.id || !product.supplier_id) return
    trackSupplierView({
      supplierId: product.supplier_id,
      productId: product.id,
      viewerId: user?.id,
    })
  }, [product?.id, product?.supplier_id, user?.id])

  usePagePresence({
    path: `/fabric/${slug ?? ''}`,
    supplierId: product?.supplier_id,
  })

  const images = useMemo(
    () =>
      (product?.images ?? []).map((path) => ({
        card: getProductImageUrl(path, { variant: 'card' }),
        medium: getProductImageUrl(path, { variant: 'medium' }),
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

    const gsm =
      getAttributeValue(product, 'weight-before-wash') ??
      getAttributeValue(product, 'gsm') ??
      getAttributeValue(product, 'weight')
    const width =
      getAttributeValue(product, 'width-inches') ?? getAttributeValue(product, 'width')
    const composition =
      getAttributeValue(product, 'fabric-content') ??
      getAttributeValue(product, 'composition') ??
      getAttributeValue(product, 'content')

    const rows: ProductSpecRow[] = [
      { label: 'GSM', value: gsm ? `${gsm} g/m²` : '—' },
      { label: 'WIDTH', value: width ? `${width}"` : '—' },
      { label: 'COMPOSITION', value: composition ?? '—' },
      { label: 'CATEGORY', value: product.category?.name ?? '—' },
      { label: 'STOCK', value: stock },
      { label: 'MOQ', value: product.moq_meters ? `${product.moq_meters} m` : '—' },
      { label: 'LEAD TIME', value: product.lead_time_days ? `${product.lead_time_days} days` : '—' },
      { label: 'PRICE', value: price },
    ]

    // Surface every remaining technical attribute the mill provided.
    const shownSlugs = new Set([
      'weight-before-wash', 'gsm', 'weight', 'width-inches', 'width',
      'fabric-content', 'composition', 'content',
    ])
    for (const attr of product.attributes ?? []) {
      if (!attr.attribute || shownSlugs.has(attr.attribute.slug)) continue
      const value =
        attr.value_text ?? (attr.value_number != null ? String(attr.value_number) : null)
      if (!value) continue
      rows.push({ label: attr.attribute.name.toUpperCase(), value })
    }

    return rows
  }, [product, currency, unit, fxRate])

  async function handleAddToCart() {
    if (!product) return

    if (!isAuthenticated || !user) {
      navigate('/auth/login', { state: { from: `/fabric/${product.slug}` } })
      return
    }

    setAdding(true)

    const { error: cartError } = await supabase.from('cart_items').upsert(
      {
        buyer_id: user.id,
        product_id: product.id,
        quantity_meters: quantity,
      },
      { onConflict: 'buyer_id,product_id' },
    )

    setAdding(false)

    if (cartError) {
      toast.error('Could not add to cart', cartError.message)
      return
    }

    toast.success('Added to cart', `${product.title} · ${quantity} m`)
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
            <div className="clip-corner overflow-hidden bg-surface">
              {images[activeImage] ? (
                <img
                  src={images[activeImage].medium}
                  srcSet={`${images[activeImage].card} 480w, ${images[activeImage].medium} 960w, ${images[activeImage].original} 1920w`}
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  alt={product.title}
                  className="aspect-square w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-elevated">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    No image
                  </span>
                </div>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-4 grid grid-cols-4 gap-3">
                {images.map((image, index) => (
                  <button
                    key={image.medium}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={cn(
                      'clip-corner-sm overflow-hidden border-2 transition-colors',
                      activeImage === index ? 'border-accent' : 'border-border',
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
                  <p className="text-sm font-medium">
                    {product.color_display_name ?? product.color_supplier_name ?? 'Unnamed'}
                  </p>
                  {product.color_family && (
                    <p className="text-xs capitalize text-text-dark-secondary">
                      {product.color_family}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-8">
              <SpecTable rows={specRows} />
            </div>

            <div className="mt-8 flex flex-wrap items-end gap-4 border-t border-border-cream pt-6">
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
                  min={product.moq_meters ?? 1}
                  step={0.5}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  className="mt-2 flex h-10 w-32 border border-border-cream bg-card px-3 text-sm text-text-dark"
                />
              </div>

              <Button onClick={handleAddToCart} disabled={adding} className="min-w-[160px]">
                <ShoppingBag className="h-4 w-4" />
                {adding ? 'Adding…' : 'Add to cart'}
              </Button>
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
    </>
  )
}
