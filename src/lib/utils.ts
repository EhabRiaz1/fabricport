import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Money, formatted for display. PKR is always whole rupees -- stored prices carry
 * import decimals (775.6, 809.71) and a USD→PKR conversion produces many more, and a
 * price list with "PKR 1,551.2" next to "PKR 755" looks broken. USD keeps two places.
 */
export function formatPrice(amount: number, currency: 'PKR' | 'USD' = 'PKR') {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }
  return `PKR ${Math.round(amount).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
}

export const YARDS_PER_METER = 1.09361

export function metersToYards(meters: number) {
  return meters * YARDS_PER_METER
}

export function yardsToMeters(yards: number) {
  return yards / YARDS_PER_METER
}

/** Shown wherever a price exists but admin has not approved it yet. */
export const PRICE_ON_REQUEST = 'Price on request'

export interface UnitPriceInput {
  price_min_pkr: number | null
  price_max_pkr?: number | null
  /** Undefined is treated as approved (callers that never see the column). */
  price_approved?: boolean | null
}

/**
 * The ONE place a per-unit price is turned into text.
 *
 * Prices are stored per metre in PKR. The unit toggle used to swap only the "/m" label
 * for "/yd" and leave the number alone, and the currency toggle preferred a stale stored
 * USD column over the live rate -- so the marketplace, the fabric page and the invoice
 * builder each showed a different figure for the same cloth. Every caller goes through
 * here now:
 *
 *   - per yard = per metre ÷ 1.09361 (a yard is shorter, so the price is lower);
 *   - USD is always converted from PKR with the rate from Settings. With no rate loaded
 *     yet the PKR figure is shown instead of a guess;
 *   - an unapproved price shows "Price on request" rather than a number.
 *
 * Returns null when the product has no price at all, so callers can print their own dash.
 */
export function formatUnitPrice(
  product: UnitPriceInput,
  currency: 'PKR' | 'USD',
  unit: 'meters' | 'yards',
  fxRate: number | null | undefined,
  options: { suffix?: boolean } = {},
): string | null {
  const { suffix = true } = options
  const unitSuffix = suffix ? (unit === 'yards' ? '/yd' : '/m') : ''

  if (product.price_approved === false) return PRICE_ON_REQUEST

  const minPkr = product.price_min_pkr ?? 0
  const maxPkr = product.price_max_pkr ?? minPkr
  if (!(minPkr > 0)) return null

  const perUnit = (pkr: number) => (unit === 'yards' ? pkr / YARDS_PER_METER : pkr)
  const useUsd = currency === 'USD' && fxRate != null && fxRate > 0
  const shownCurrency: 'PKR' | 'USD' = useUsd ? 'USD' : 'PKR'
  const toShown = (pkr: number) => (useUsd ? perUnit(pkr) / fxRate : perUnit(pkr))

  const min = toShown(minPkr)
  const max = toShown(maxPkr)
  // Compare in the displayed precision so a range that rounds to one figure prints once.
  const same =
    maxPkr <= minPkr || formatPrice(min, shownCurrency) === formatPrice(max, shownCurrency)

  return same
    ? `${formatPrice(min, shownCurrency)}${unitSuffix}`
    : `${formatPrice(min, shownCurrency)} – ${formatPrice(max, shownCurrency)}${unitSuffix}`
}

/**
 * Order-quantity bounds for a fabric, in whole metres. The minimum is the MOQ (or 1),
 * the maximum is the stock when there is any. Stock is a soft fact for made-to-order
 * cloth, so a null max means "no upper bound beyond the global sanity cap".
 */
export const MAX_ORDER_METERS = 10_000_000

export function quantityBounds(product: {
  moq_meters?: number | null
  stock_meters?: number | null
}): { min: number; max: number | null } {
  const min = Math.max(1, Math.ceil(product.moq_meters ?? 1))
  const stock = product.stock_meters ?? 0
  const max = stock > 0 ? Math.max(min, Math.floor(stock)) : null
  return { min, max }
}

export function clampQuantity(
  value: number,
  bounds: { min: number; max: number | null },
): number {
  if (!Number.isFinite(value)) return bounds.min
  const whole = Math.round(value)
  const upper = bounds.max ?? MAX_ORDER_METERS
  return Math.min(Math.max(whole, bounds.min), upper)
}

/** Human message when a typed quantity is outside the bounds; null when it is fine. */
export function quantityIssue(
  value: number,
  bounds: { min: number; max: number | null },
): string | null {
  if (!Number.isFinite(value) || value <= 0) return `Enter at least ${bounds.min} m.`
  if (value !== Math.round(value)) return 'Quantities are in whole metres.'
  if (value < bounds.min) return `Minimum order is ${bounds.min.toLocaleString('en-PK')} m.`
  if (bounds.max != null && value > bounds.max) {
    return `Only ${bounds.max.toLocaleString('en-PK')} m in stock.`
  }
  if (value > MAX_ORDER_METERS) return 'That quantity is too large.'
  return null
}

/**
 * Grams per square metre -> ounces per square yard.
 *
 * 1 oz/yd² is 33.906 g/m². The legacy site printed both ("185 GSM | 5.45 Oz") and mills
 * outside South Asia quote in ounces, so a card that shows only GSM is unreadable to half
 * the buyers.
 */
export function gsmToOunces(gsm: number) {
  return gsm / 33.906
}

/**
 * "185 g/m² · 5.45 oz" — the long form, for spec tables.
 *
 * Callers hand this a number they have already resolved; free-form legacy attribute text
 * ("301 GSM") is printed verbatim by `lib/product-specs` instead, because it carries its
 * own unit and appending a second one is how "301 GSM GSM g/m²" happened.
 */
export function formatGsm(gsm: number) {
  return `${gsm} g/m² · ${gsmToOunces(gsm).toFixed(2)} oz`
}

export function parseStockMeters(label?: string | null) {
  if (!label) return 0
  const match = label.replace(/,/g, '').match(/([\d.]+)/)
  return match ? Number(match[1]) : 0
}

export function parseGsm(weight?: string | null) {
  if (!weight) return null
  const match = weight.match(/(\d+)\s*GSM/i)
  return match ? Number(match[1]) : null
}

export function parseWidthCm(width?: string | null) {
  if (!width) return null
  const inches = Number(width)
  if (Number.isNaN(inches)) return null
  return Math.round(inches * 2.54)
}

export type {
  ProductImageOptions,
  ProductImageVariant,
} from '@/lib/product-images'
export {
  getDigitalFabricName,
  getDigitalFabricUrl,
  getProductImageOriginalUrl,
  getProductImagePublicUrl,
  getProductImageStoragePath,
  getProductImageUrl,
  getProductImageVariantPath,
  isDerivedProductImagePath,
  PRODUCT_IMAGE_VARIANTS,
} from '@/lib/product-images'
