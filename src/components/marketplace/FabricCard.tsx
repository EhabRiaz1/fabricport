import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  cn,
  formatPrice,
  getProductImageUrl,
  metersToYards,
} from '@/lib/utils'
import type { ProductImageVariant } from '@/lib/product-images'
import { convertPrice } from '@/lib/fx'
import { WishlistButton } from '@/components/marketplace/WishlistButton'
import type { FabricCardProps } from '@/types/app'

function getAttributeValue(
  product: FabricCardProps['product'],
  slug: string,
): string | null {
  const match = product.attributes?.find((attr) => attr.attribute?.slug === slug)
  if (!match) return null
  if (match.value_text) return match.value_text
  if (match.value_number != null) return String(match.value_number)
  return null
}

function formatProductPrice(
  product: FabricCardProps['product'],
  currency: FabricCardProps['currency'],
  fxRate: number,
): string {
  const minPkr = product.price_min_pkr ?? 0
  const maxPkr = product.price_max_pkr ?? minPkr
  const minUsd = product.price_min_usd ?? convertPrice(minPkr, 'PKR', 'USD', fxRate)
  const maxUsd = product.price_max_usd ?? convertPrice(maxPkr, 'PKR', 'USD', fxRate)

  const min = currency === 'USD' ? minUsd : minPkr
  const max = currency === 'USD' ? maxUsd : maxPkr

  if (min === 0) return '—'
  if (min === max || max === 0) return formatPrice(min, currency)
  return `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`
}

/* ------------------------------------------------------------------ */
/* Compact variant — horizontal list row                               */
/* ------------------------------------------------------------------ */
function CompactCard({ product, currency = 'PKR', unit = 'meters', fxRate = 278, className }: FabricCardProps) {
  const imageUrl = product.images[0]
    ? getProductImageUrl(product.images[0], { variant: 'card' })
    : null
  const priceValue = formatProductPrice(product, currency, fxRate)
  const unitSuffix = unit === 'yards' ? '/yd' : '/m'
  const stock = unit === 'yards'
    ? `${metersToYards(product.stock_meters).toFixed(0)} yd`
    : `${product.stock_meters.toFixed(0)} m`

  return (
    <Link
      to={`/fabric/${product.slug}`}
      className={cn(
        'group flex items-center gap-4 border-b border-border py-4 transition-colors hover:bg-surface/50',
        className,
      )}
    >
      <div className="h-14 w-14 shrink-0 clip-corner-sm overflow-hidden bg-elevated">
        {imageUrl
          ? <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" />
          : <div className="h-full w-full" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold text-text-primary group-hover:text-accent">
          {product.title}
        </p>
        {product.supplier && (
          <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-widest text-text-muted">
            {product.supplier.brand_name}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-xs text-text-secondary">{priceValue}{unitSuffix}</p>
        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-text-muted">{stock}</p>
      </div>
      {product.color_hex && (
        <span className="h-4 w-4 shrink-0 border border-border-cream" style={{ backgroundColor: product.color_hex }} />
      )}
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/* Anduril-style card — matches the screenshot exactly                 */
/* ------------------------------------------------------------------ */
function ProductCardImage({
  path,
  alt,
  variant = 'card',
  eager,
  className,
}: {
  path: string
  alt: string
  variant?: ProductImageVariant
  eager?: boolean
  className?: string
}) {
  const primarySrc = getProductImageUrl(path, { variant })
  const fallbackSrc =
    variant === 'original' ? null : getProductImageUrl(path, { variant: 'original' })
  const [src, setSrc] = useState(primarySrc)
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setSrc(primarySrc)
    setLoaded(false)
  }, [primarySrc])

  useEffect(() => {
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [src])

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-[#C8C4BC]" aria-hidden />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={cn(className, !loaded && 'opacity-0')}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (fallbackSrc && src !== fallbackSrc) {
            setSrc(fallbackSrc)
            setLoaded(false)
            return
          }
          setLoaded(true)
        }}
      />
    </>
  )
}

function FabricCardComponent({
  product,
  variant = 'grid',
  currency = 'PKR',
  unit = 'meters',
  fxRate = 278,
  onAddToCart,
  className,
  imagePriority = false,
}: FabricCardProps) {
  const isFeatured = variant === 'featured'
  const isGrid = variant === 'grid'
  const imagePath = product.images[0] ?? null

  if (variant === 'compact') return (
    <CompactCard product={product} variant={variant} currency={currency} unit={unit} fxRate={fxRate} onAddToCart={onAddToCart} className={className} />
  )

  const priceValue = formatProductPrice(product, currency, fxRate)
  const unitSuffix = unit === 'yards' ? '/yd' : '/m'
  // Prefer the real spec columns (backfilled); fall back to legacy EAV attributes.
  const gsm = product.gsm != null
    ? String(product.gsm)
    : getAttributeValue(product, 'weight-before-wash')
      ?? getAttributeValue(product, 'gsm')
      ?? getAttributeValue(product, 'weight')
  const width = product.width_inches != null
    ? String(product.width_inches)
    : getAttributeValue(product, 'width-inches')
      ?? getAttributeValue(product, 'width')
  const composition = product.composition
    ?? getAttributeValue(product, 'fabric-content')
    ?? getAttributeValue(product, 'composition')
  const stock = unit === 'yards'
    ? `${metersToYards(product.stock_meters).toFixed(0)} yd`
    : `${product.stock_meters.toFixed(0)} m`

  const cardClassName = cn(
    'group relative flex flex-col clip-corner clip-corner-accent bg-card select-none transition-transform duration-200',
    isGrid && 'aspect-square w-full overflow-hidden hover:-translate-y-1',
    isFeatured && 'min-h-[420px]',
    !isGrid && !isFeatured && 'min-h-[340px]',
    className,
  )

  const cardBody = (
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className={cn('shrink-0', isGrid ? 'px-4 pb-1 pt-4' : 'px-5 pb-2 pt-5')}>
          <h3
            className={cn(
              'font-display font-semibold leading-tight text-text-dark transition-colors group-hover:text-accent line-clamp-2',
              isFeatured ? 'text-lg' : isGrid ? 'text-sm sm:text-base' : 'text-sm',
            )}
          >
            {product.title}
          </h3>
          {product.supplier && (
            <p className="mt-0.5 truncate font-mono text-[8px] uppercase tracking-[0.18em] text-text-dark-secondary">
              {product.supplier.brand_name}
              {product.supplier.is_verified && (
                <span className="ml-1 text-accent">✓</span>
              )}
            </p>
          )}
        </div>

        {/* Image fills remaining square space */}
        <div className={cn(
          'relative min-h-0 flex-1 overflow-hidden bg-[#D8D4CC]',
          isFeatured ? 'mx-4 my-3 h-48 shrink-0' : isGrid ? 'mx-3 mb-2' : 'mx-4 my-3 h-36 shrink-0',
        )}>
          {imagePath ? (
            <ProductCardImage
              path={imagePath}
              alt={product.title}
              variant={isGrid ? 'card' : isFeatured ? 'medium' : 'medium'}
              eager={isGrid && imagePriority}
              className="h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="font-mono text-[9px] uppercase tracking-widest text-text-dark-secondary/50">
                No image
              </span>
            </div>
          )}
          {/* Color swatch overlay */}
          {product.color_hex && (
            <span
              className="absolute bottom-2 left-2 h-5 w-5 border border-card shadow-sm"
              style={{ backgroundColor: product.color_hex }}
              title={product.color_display_name ?? undefined}
            />
          )}
          {/* Wishlist heart mirrors the swatch at the bottom-right of the image */}
          <WishlistButton
            productId={product.id}
            className="absolute bottom-2 right-2 z-20"
          />
        </div>

        {/* Spec rows — compact for square grid */}
        <div className={cn('shrink-0', isGrid && 'pb-3')}>
          <div className="mx-0 h-px bg-[#C8C4BC]" />

          <div className="grid grid-cols-2 divide-x divide-[#C8C4BC]">
            <div className={cn(isGrid ? 'px-3 py-2' : 'px-5 py-3')}>
              <p className="font-mono text-[7px] font-semibold uppercase tracking-[0.18em] text-text-dark sm:text-[8px]">
                GSM
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-text-dark-secondary sm:text-xs">
                {gsm ?? '—'}
              </p>
            </div>
            <div className={cn(isGrid ? 'px-3 py-2' : 'px-5 py-3')}>
              <p className="font-mono text-[7px] font-semibold uppercase tracking-[0.18em] text-text-dark sm:text-[8px]">
                WIDTH
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-text-dark-secondary sm:text-xs">
                {width ? `${width}"` : '—'}
              </p>
            </div>
          </div>

          <div className="h-px bg-[#C8C4BC]" />

          <div className="grid grid-cols-2 divide-x divide-[#C8C4BC]">
            <div className={cn(isGrid ? 'px-3 py-2' : 'px-5 py-3')}>
              <p className="font-mono text-[7px] font-semibold uppercase tracking-[0.18em] text-text-dark sm:text-[8px]">
                PRICE
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-text-dark-secondary sm:text-xs">
                {priceValue}{unitSuffix}
              </p>
            </div>
            <div className={cn(isGrid ? 'px-3 py-2' : 'px-5 py-3')}>
              <p className="font-mono text-[7px] font-semibold uppercase tracking-[0.18em] text-text-dark sm:text-[8px]">
                STOCK
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-text-dark-secondary sm:text-xs">
                {stock}
              </p>
            </div>
          </div>

          {!isGrid && (
            <>
              <div className="h-px bg-[#C8C4BC]" />
              <div className="grid grid-cols-2 divide-x divide-[#C8C4BC]">
                <div className="px-5 py-3 sm:col-span-2">
                  <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-text-dark">
                    CONTENT
                  </p>
                  <p className="mt-0.5 font-mono text-xs leading-tight text-text-dark-secondary line-clamp-1">
                    {composition ?? '—'}
                  </p>
                </div>
              </div>
              {onAddToCart && (
                <>
                  <div className="h-px bg-[#C8C4BC]" />
                  <div className="relative z-20 flex justify-end px-5 py-3">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); onAddToCart(product.id) }}
                      className="font-mono text-[8px] uppercase tracking-widest text-accent border border-accent px-3 py-1.5 transition-colors hover:bg-accent hover:text-white clip-corner-sm"
                    >
                      Enquire
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Stretched navigation link — covers the whole card, sits beneath the
            wishlist heart and any inline action buttons (z-20). */}
        <Link
          to={`/fabric/${product.slug}`}
          aria-label={product.title}
          className="absolute inset-0 z-10"
        />
      </div>
  )

  if (isGrid) {
    return <article className={cardClassName}>{cardBody}</article>
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className={cardClassName}
    >
      {cardBody}
    </motion.article>
  )
}

export const FabricCard = memo(FabricCardComponent)
export default FabricCard
