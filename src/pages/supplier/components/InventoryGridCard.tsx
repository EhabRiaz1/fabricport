import { Box, ExternalLink, Eye, EyeOff, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/ui/badge'
import { cn, formatPrice, getProductImageUrl } from '@/lib/utils'
import { getGsmLabelShort, getWidth } from '@/lib/product-specs'
import type { ProductWithRelations } from '@/types/app'

export interface InventoryGridCardProps {
  product: ProductWithRelations
  onEdit: (product: ProductWithRelations) => void
}

/**
 * One fabric in the supplier inventory grid.
 *
 * Deliberately the same shape as the marketplace card — square photo, spec cells beneath —
 * because that is how a supplier's buyers see their catalogue, and the whole point of the
 * grid view is "show me my listings the way the market sees them". What it adds is the
 * things only the owner cares about: publication status, visibility, and whether a price
 * edit is still waiting on admin approval.
 *
 * The whole card is the edit button. The two links inside it (view live, in a new tab)
 * stop propagation so they do not trip the editor open.
 */
export function InventoryGridCard({ product, onEdit }: InventoryGridCardProps) {
  const imagePath = product.images?.[0] ?? null
  const gsm = getGsmLabelShort(product)
  const width = getWidth(product)
  const price =
    product.price_min_pkr == null
      ? '—'
      : product.price_max_pkr && product.price_max_pkr !== product.price_min_pkr
        ? `${formatPrice(product.price_min_pkr)} – ${formatPrice(product.price_max_pkr)}`
        : formatPrice(product.price_min_pkr)
  const pricePending = !product.price_approved && product.price_min_pkr != null
  const isPrivate = product.visibility === 'private'
  const hasDigitalFabric = (product.scan_files?.length ?? 0) > 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(product)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onEdit(product)
        }
      }}
      aria-label={`Edit ${product.title}`}
      className="group clip-corner relative flex flex-col bg-card text-left transition-transform duration-200 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="shrink-0 px-4 pb-1 pt-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 h-[2.5rem] min-w-0 flex-1 font-display text-sm font-semibold leading-tight text-text-dark transition-colors group-hover:text-accent sm:text-base">
            {product.title}
          </h3>
          <StatusBadge status={product.status} className="shrink-0" />
        </div>
        <p className="mt-0.5 h-[12px] truncate font-mono text-[8px] uppercase tracking-[0.18em] text-text-dark-secondary">
          {product.category?.name ?? 'Uncategorized'}
        </p>
      </div>

      <div className="relative mx-3 mb-2 aspect-square shrink-0 overflow-hidden bg-[#D8D4CC]">
        {imagePath ? (
          <img
            src={getProductImageUrl(imagePath, { variant: 'card' })}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[9px] uppercase tracking-widest text-text-dark-secondary/50">
            No image
          </div>
        )}

        <span
          className={cn(
            'pointer-events-none absolute left-2 top-2 flex items-center gap-1 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em]',
            isPrivate ? 'bg-[#2C1A0E]/85 text-[#F5EDE4]' : 'bg-[#F0ECE4]/90 text-text-dark',
          )}
        >
          {isPrivate ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
          {isPrivate ? 'Private' : 'Public'}
        </span>

        {hasDigitalFabric && (
          <span
            className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 bg-[#2C1A0E]/85 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.16em] text-[#F5EDE4]"
            title="A .zfab digital fabric is attached"
          >
            <Box className="h-2.5 w-2.5" />
            ZFAB
          </span>
        )}

        {product.color_hex && (
          <span
            className="pointer-events-none absolute bottom-2 left-2 h-5 w-5 border border-card shadow-sm"
            style={{ backgroundColor: product.color_hex }}
            title={product.color_display_name ?? undefined}
          />
        )}

        {/* Opens the public listing so a supplier can check what buyers actually see. */}
        <Link
          to={`/fabric/${product.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          title="View live listing"
          aria-label={`View ${product.title} on the marketplace`}
          className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center bg-[#2C1A0E]/85 text-[#F5EDE4] opacity-0 transition-opacity duration-200 hover:bg-[#2C1A0E] group-hover:opacity-100 focus:opacity-100"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="shrink-0 pb-3">
        <div className="h-px bg-[#C8C4BC]" />
        <div className="grid grid-cols-2 divide-x divide-[#C8C4BC]">
          {/* compact: "390 g · 11.5 oz" is 15 characters and this grid runs four columns
              wide, leaving ~106px per cell — 12px mono truncates the ounces off. */}
          <Cell label="GSM" value={gsm ?? '—'} compact />
          <Cell label="WIDTH" value={width ? `${width}"` : '—'} />
        </div>
        <div className="h-px bg-[#C8C4BC]" />
        <div className="grid grid-cols-2 divide-x divide-[#C8C4BC]">
          <Cell label="PRICE" value={price} />
          <Cell label="STOCK" value={`${product.stock_meters.toFixed(0)} m`} />
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 px-3">
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.14em] text-warning">
            {pricePending ? 'Price pending approval' : ''}
          </p>
          <span className="flex shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-text-dark-secondary transition-colors group-hover:text-accent">
            <Pencil className="h-3 w-3" />
            Edit
          </span>
        </div>
      </div>
    </div>
  )
}

function Cell({
  label,
  value,
  compact,
}: {
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div className="px-3 py-2">
      <p className="font-mono text-[7px] font-semibold uppercase tracking-[0.18em] text-text-dark sm:text-[8px]">
        {label}
      </p>
      <p
        className={cn(
          'mt-0.5 truncate font-mono text-text-dark-secondary',
          compact ? 'text-[10px]' : 'text-[10px] sm:text-xs',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export default InventoryGridCard
