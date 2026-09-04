import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Download, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { SpecTable } from '@/components/shared/SpecTable'
import { WishlistButton } from '@/components/marketplace/WishlistButton'
import { VerifiedBadge } from '@/components/ui/badge'
import {
  cn,
  formatPrice,
  getDigitalFabricName,
  getDigitalFabricUrl,
  getProductImageUrl,
  metersToYards,
} from '@/lib/utils'
import { convertPrice } from '@/lib/fx'
import {
  getAvailability,
  getComposition,
  getConstruction,
  getFabricType,
  getGsmLabel,
  getPattern,
  getWeaveOrKnit,
  getWidth,
} from '@/lib/product-specs'
import { useLenisLock } from '@/lib/lenis'
import type { Currency, ProductSpecRow, ProductWithRelations, Unit } from '@/types/app'

export interface FabricQuickViewProps {
  /** Null closes the modal. Kept as the product itself so the caller needs no id lookup. */
  product: ProductWithRelations | null
  onOpenChange: (open: boolean) => void
  currency?: Currency
  unit?: Unit
  fxRate?: number
}

/**
 * Quick-view modal for a marketplace fabric.
 *
 * Opened by clicking a card's photo. The point is to answer "is this the right cloth?"
 * without losing the grid and its scroll position -- so it carries the photo at a useful
 * size plus the specs a buyer filters on, and defers everything transactional (inquiry,
 * cart, samples) to the full product page behind the one link at the bottom.
 *
 * Radix `Dialog` rather than the bottom `Sheet` used by `ImageViewer`: this is a panel you
 * read and dismiss with the ✕, not a fullscreen photo surface.
 */
export function FabricQuickView({
  product,
  onOpenChange,
  currency = 'PKR',
  unit = 'meters',
  fxRate = 278,
}: FabricQuickViewProps) {
  const open = product != null
  const [activeImage, setActiveImage] = useState(0)

  // Lenis keeps its own scroll target and would resume mid-animation on close; Radix's
  // body lock alone does not stop it. Same treatment as the cart drawer.
  useLenisLock(open)

  useEffect(() => {
    setActiveImage(0)
  }, [product?.id])

  const images = useMemo(
    () => product?.images ?? [],
    [product?.images],
  )

  const specRows = useMemo<ProductSpecRow[]>(() => {
    if (!product) return []

    const unitSuffix = unit === 'yards' ? '/yd' : '/m'
    const minPkr = product.price_min_pkr ?? 0
    const maxPkr = product.price_max_pkr ?? minPkr
    const min =
      currency === 'USD'
        ? product.price_min_usd ?? convertPrice(minPkr, 'PKR', 'USD', fxRate)
        : minPkr
    const max =
      currency === 'USD'
        ? product.price_max_usd ?? convertPrice(maxPkr, 'PKR', 'USD', fxRate)
        : maxPkr
    const price =
      min === 0
        ? '—'
        : min === max || max === 0
          ? `${formatPrice(min, currency)}${unitSuffix}`
          : `${formatPrice(min, currency)} – ${formatPrice(max, currency)}${unitSuffix}`

    const stock =
      unit === 'yards'
        ? `${metersToYards(product.stock_meters).toFixed(0)} yards`
        : `${product.stock_meters.toFixed(0)} meters`

    const rows: ProductSpecRow[] = [
      { label: 'GSM', value: getGsmLabel(product) ?? '—' },
      { label: 'WIDTH', value: getWidth(product) ? `${getWidth(product)}"` : '—' },
      { label: 'COMPOSITION', value: getComposition(product) ?? '—' },
      { label: 'FABRIC TYPE', value: getFabricType(product) ?? '—' },
      { label: 'WEAVE / KNIT', value: getWeaveOrKnit(product) ?? '—' },
      { label: 'PRICE', value: price },
      { label: 'STOCK', value: stock },
    ]

    // Optional rows, added only when the mill actually provided them -- a modal of
    // dashes is worse than a shorter modal.
    const pattern = getPattern(product)
    if (pattern) rows.push({ label: 'PATTERN', value: pattern })
    const construction = getConstruction(product)
    if (construction) rows.push({ label: 'CONSTRUCTION', value: construction })
    const availability = getAvailability(product)
    if (availability) rows.push({ label: 'AVAILABILITY', value: availability })
    if (product.moq_meters) rows.push({ label: 'MOQ', value: `${product.moq_meters} m` })
    if (product.lead_time_days) {
      rows.push({ label: 'LEAD TIME', value: `${product.lead_time_days} days` })
    }

    return rows
  }, [product, currency, unit, fxRate])

  if (!product) return null

  const digitalFabric = product.scan_files?.[0] ?? null
  const heroPath = images[activeImage] ?? images[0] ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // focus:outline-none because onOpenAutoFocus below focuses this panel, and the UA
        // draws its default ring on a programmatically focused container.
        className="max-h-[92dvh] w-[calc(100vw-2rem)] max-w-4xl overflow-y-auto bg-card p-0 text-text-dark focus:outline-none sm:w-full"
        aria-describedby={undefined}
        // Radix otherwise focuses the first focusable child, which here is the wishlist
        // heart -- so the modal opens with a stray focus ring on an unrelated control.
        // Focusing the panel keeps the dialog keyboard-reachable without that.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          ;(event.currentTarget as HTMLElement | null)?.focus()
        }}
      >
        <div className="grid gap-0 md:grid-cols-2">
          {/* Photo column */}
          <div className="bg-[#D8D4CC] p-4 sm:p-6">
            <div className="relative aspect-square w-full overflow-hidden bg-[#D8D4CC]">
              {heroPath ? (
                <img
                  src={getProductImageUrl(heroPath, { variant: 'medium' })}
                  srcSet={`${getProductImageUrl(heroPath, { variant: 'medium' })} 960w, ${getProductImageUrl(heroPath, { variant: 'large' })} 1600w`}
                  sizes="(min-width: 768px) 40vw, 90vw"
                  alt={product.title}
                  className="h-full w-full object-contain"
                  decoding="async"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary/60">
                  No image
                </div>
              )}
              {product.color_hex && (
                <span
                  className="absolute bottom-2 left-2 h-6 w-6 border border-card shadow-sm"
                  style={{ backgroundColor: product.color_hex }}
                  title={product.color_display_name ?? product.color_family ?? undefined}
                />
              )}
              <WishlistButton productId={product.id} className="absolute bottom-2 right-2" />
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
                {images.map((path, index) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`Image ${index + 1}`}
                    className={cn(
                      'h-14 w-14 shrink-0 overflow-hidden border-2 transition-colors',
                      index === activeImage ? 'border-accent' : 'border-transparent',
                    )}
                  >
                    <img
                      src={getProductImageUrl(path, { variant: 'card' })}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail column. pr-10 keeps the heading clear of the ✕ Radix renders at top-4. */}
          <div className="flex flex-col p-5 pr-10 sm:p-6 sm:pr-12">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              {getFabricType(product) ?? 'Fabric'}
            </p>
            <DialogTitle className="mt-1.5 font-display text-xl font-semibold tracking-tight text-text-dark sm:text-2xl">
              {product.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Quick view of {product.title}. Specifications and a link to the full product
              page.
            </DialogDescription>

            {product.supplier && (
              <Link
                to={`/supplier/${product.supplier.slug}`}
                className="mt-2 inline-flex w-fit items-center gap-2 text-sm text-text-dark-secondary transition-colors hover:text-accent"
              >
                {product.supplier.brand_name}
                {product.supplier.is_verified && <VerifiedBadge />}
              </Link>
            )}

            {(product.color_display_name ||
              product.color_supplier_name ||
              product.color_family) && (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                Colour ·{' '}
                <span className="capitalize text-text-dark">
                  {product.color_display_name ??
                    product.color_supplier_name ??
                    product.color_family}
                </span>
              </p>
            )}

            <div className="mt-4">
              <SpecTable rows={specRows} />
            </div>

            {digitalFabric && (
              <a
                href={getDigitalFabricUrl(digitalFabric)}
                download={getDigitalFabricName(digitalFabric)}
                className="clip-corner-sm mt-4 inline-flex w-fit items-center gap-2 border border-border-cream px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-dark transition-colors hover:border-accent hover:text-accent"
              >
                <Box className="h-3.5 w-3.5" />
                ZFAB
                <Download className="h-3.5 w-3.5" />
              </a>
            )}

            {/*
              * The only way out of the modal into the transactional page. Opened in a new
              * tab deliberately: the modal exists so the grid and its scroll position
              * survive, and a same-tab jump would throw that away.
              */}
            <a
              href={`/fabric/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="clip-corner-sm mt-6 inline-flex items-center justify-center gap-2 bg-accent px-6 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white transition-colors hover:bg-accent/90"
            >
              Open full product page
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default FabricQuickView
