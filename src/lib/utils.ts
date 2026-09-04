import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(amount: number, currency: 'PKR' | 'USD' = 'PKR') {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }
  return `PKR ${amount.toLocaleString('en-PK')}`
}

export function metersToYards(meters: number) {
  return meters * 1.09361
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
