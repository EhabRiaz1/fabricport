import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Box } from 'lucide-react'
import {
  cn,
  formatPrice,
  getProductImageUrl,
  metersToYards,
} from '@/lib/utils'
import type { ProductImageVariant } from '@/lib/product-images'
import {
  getComposition,
  getFabricType,
  getGsmLabelShort,
  getWeaveOrKnit,
  getWidth,
} from '@/lib/product-specs'
import { convertPrice } from '@/lib/fx'
import { WishlistButton } from '@/components/marketplace/WishlistButton'
import type { FabricCardProps } from '@/types/app'

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
      // Same new-tab rule as the grid card, so the two variants cannot disagree.
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${product.title} — opens in a new tab`}
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
  sizes,
}: {
  path: string
  alt: string
  variant?: ProductImageVariant
  eager?: boolean
  className?: string
  sizes?: string
}) {
  const primarySrc = getProductImageUrl(path, { variant })
  // Cards used to request a single 480w file, which is visibly soft in a ~300 CSS px cell on
  // a 2x display. Only the generated variants are listed -- their widths are known by
  // construction, unlike `original`, whose dimensions vary per image. The srcSet is dropped
  // once the onError fallback kicks in, so the fallback request is unambiguous.
  const srcSet =
    variant === 'original'
      ? undefined
      : `${getProductImageUrl(path, { variant: 'card' })} 480w, ${getProductImageUrl(path, { variant: 'medium' })} 960w`
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
        srcSet={src === primarySrc ? srcSet : undefined}
        sizes={src === primarySrc ? sizes : undefined}
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
  onOpenQuickView,
}: FabricCardProps) {
  const isFeatured = variant === 'featured'
  const isGrid = variant === 'grid'
  const imagePath = product.images[0] ?? null

  if (variant === 'compact') return (
    <CompactCard product={product} variant={variant} currency={currency} unit={unit} fxRate={fxRate} onAddToCart={onAddToCart} className={className} />
  )

  const priceValue = formatProductPrice(product, currency, fxRate)
  const unitSuffix = unit === 'yards' ? '/yd' : '/m'
  // All spec reads go through lib/product-specs so the card, the quick-view modal and the
  // detail page cannot drift apart on fallback order again.
  const gsm = getGsmLabelShort(product)
  const width = getWidth(product)
  const composition = getComposition(product)
  const weave = getWeaveOrKnit(product)
  const fabricType = getFabricType(product)
  const hasDigitalFabric = (product.scan_files?.length ?? 0) > 0
  const stock = unit === 'yards'
    ? `${metersToYards(product.stock_meters).toFixed(0)} yd`
    : `${product.stock_meters.toFixed(0)} m`
  // "Knit · Organic Cotton 100%" — the legacy card's category + composition line.
  const typeAndComposition = [fabricType, composition].filter(Boolean).join(' · ')

  // Grid cards used to be `aspect-square` with the image box as the only flexible
  // row, so the image height was (square - header - specs). A 2-line title or a
  // missing supplier line changed the header height, which changed the image
  // height, which is why photos looked rectangular in narrow columns and square in
  // wide ones. Fix is structural: pin BOTH variable rows (title reserves 2 lines,
  // supplier line always reserves its space), give the image a real aspect-square,
  // and drop the card's own aspect ratio. Card height is then identical for every
  // card by construction, so the grid stays uniform without the flex trap.
  const cardClassName = cn(
    'group relative flex flex-col clip-corner clip-corner-accent bg-card select-none transition-transform duration-200',
    isGrid && 'w-full overflow-hidden hover:-translate-y-1',
    isFeatured && 'min-h-[420px]',
    !isGrid && !isFeatured && 'min-h-[340px]',
    className,
  )

  const cardBody = (
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className={cn('shrink-0', isGrid ? 'px-4 pb-1 pt-4' : 'px-5 pb-2 pt-5')}>
          {/* Stock sits beside the name rather than in the spec grid: it is the number
              buyers scan for first, and the legacy card badged it over the photo. */}
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                'min-w-0 flex-1 font-display font-semibold text-text-dark transition-colors group-hover:text-accent line-clamp-2',
                // The `/[1.2]` modifier sets font-size and line-height in one declaration.
                // Plain `leading-tight` loses to the line-height that Tailwind's `text-base`
                // ships with, which made a wrapped title 48px tall inside a 40px box and
                // pushed its second line over the supplier name.
                isFeatured
                  ? 'text-lg/[1.2]'
                  : isGrid
                    ? 'text-sm/[1.2] sm:text-base/[1.2]'
                    : 'text-sm/[1.2]',
                // Reserve two lines whether the title wraps or not.
                isGrid && 'h-[2.1rem] sm:h-[2.4rem]',
              )}
            >
              {product.title}
            </h3>
            <span
              className="mt-0.5 shrink-0 border border-[#C8C4BC] bg-[#F0ECE4] px-1.5 py-0.5 font-mono text-[9px] tabular-nums tracking-wide text-text-dark-secondary"
              title={`${product.stock_meters.toFixed(0)} meters in stock`}
            >
              {stock}
            </span>
          </div>
          {/* In grid the element is always rendered so a supplier-less product does
              not gift its row height to the image. */}
          {(product.supplier || isGrid) && (
            <p
              className={cn(
                'mt-0.5 truncate font-mono text-[8px] uppercase tracking-[0.18em] text-text-dark-secondary',
                isGrid && 'h-[12px]',
              )}
            >
              {product.supplier?.brand_name}
              {product.supplier?.is_verified && <span className="ml-1 text-accent">✓</span>}
            </p>
          )}
        </div>

        {/* Grid: a real square. Other variants keep their fixed heights. */}
        <div className={cn(
          'relative overflow-hidden bg-[#D8D4CC]',
          isFeatured
            ? 'mx-4 my-3 h-48 min-h-0 shrink-0 flex-1'
            : isGrid
              ? 'mx-3 mb-2 aspect-square shrink-0'
              : 'mx-4 my-3 h-36 min-h-0 shrink-0 flex-1',
        )}>
          {imagePath ? (
            <ProductCardImage
              path={imagePath}
              alt={product.title}
              variant={isGrid ? 'card' : isFeatured ? 'medium' : 'medium'}
              sizes={
                isGrid
                  ? '(min-width: 1536px) 22vw, (min-width: 1280px) 30vw, (min-width: 640px) 45vw, 92vw'
                  : '(min-width: 1024px) 33vw, 92vw'
              }
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
          {/*
            * The photo is its own control, above the card's stretched navigation link, so a
            * click on it opens the quick-view modal instead of leaving the grid. Only wired
            * up when a handler is supplied -- the detail page's related-fabric strip has
            * none, and there the whole card should simply navigate.
            */}
          {onOpenQuickView && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenQuickView(product)
              }}
              aria-label={`Quick view — ${product.title}`}
              className="absolute inset-0 z-20 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              {/* Centred rather than a bottom bar: the bottom edge already carries the
                  colour swatch and the wishlist heart, and a full-width strip sat on top
                  of the heart. */}
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-[#140A04]/85 px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-[#F5EDE4] opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              >
                Quick view
              </span>
            </button>
          )}
          {/* Color swatch overlay */}
          {product.color_hex && (
            <span
              className="pointer-events-none absolute bottom-2 left-2 z-30 h-5 w-5 border border-card shadow-sm"
              style={{ backgroundColor: product.color_hex }}
              title={product.color_display_name ?? undefined}
            />
          )}
          {hasDigitalFabric && (
            <span
              className="pointer-events-none absolute left-2 top-2 z-30 flex items-center gap-1 bg-[#2C1A0E]/85 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-[#F5EDE4]"
              title="A CLO / Marvelous Designer .zfab file is available for this fabric"
            >
              <Box className="h-2.5 w-2.5" />
              ZFAB
            </span>
          )}
          {/* Wishlist heart mirrors the swatch at the bottom-right of the image */}
          <WishlistButton
            productId={product.id}
            className="absolute bottom-2 right-2 z-30"
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
              {/* Held at 10px at every breakpoint: "340 g · 10.0 oz" is 15 characters and
                  the cell is ~104px, which at the 12px the other cells use truncates the
                  ounces off exactly the fabrics that are heavy enough to care. */}
              <p className="mt-0.5 truncate font-mono text-[10px] text-text-dark-secondary">
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
                WEAVE
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-text-dark-secondary sm:text-xs">
                {weave ?? '—'}
              </p>
            </div>
          </div>

          {/* Fabric type + composition, as the legacy card printed them. Fixed height in
              grid so a two-word composition and a twenty-word one give the same card. */}
          {isGrid && (
            <>
              <div className="h-px bg-[#C8C4BC]" />
              <div className="px-3 py-2">
                <p className="h-[14px] truncate font-mono text-[10px] leading-[14px] text-text-dark-secondary">
                  {typeAndComposition || '—'}
                </p>
              </div>
            </>
          )}

          {!isGrid && (
            <>
              <div className="h-px bg-[#C8C4BC]" />
              <div className="grid grid-cols-2 divide-x divide-[#C8C4BC]">
                <div className="px-5 py-3 sm:col-span-2">
                  <p className="font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-text-dark">
                    CONTENT
                  </p>
                  <p className="mt-0.5 font-mono text-xs leading-tight text-text-dark-secondary line-clamp-1">
                    {typeAndComposition || '—'}
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

        {/*
          * Stretched navigation link — covers the whole card, sits beneath the wishlist
          * heart, the quick-view photo button and any inline actions (z-20+).
          *
          * Opens in a new tab. Browsing a fabric catalogue is a compare-many exercise: the
          * grid, its filters and its scroll position are expensive to rebuild, and losing
          * them to every product you want a closer look at is the thing that made people
          * stop opening products at all. The quick-view modal's own button does the same,
          * so a card and its modal behave identically.
          */}
        <Link
          to={`/fabric/${product.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${product.title} — opens in a new tab`}
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
