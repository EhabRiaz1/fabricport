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
  getProductImageOriginalUrl,
  getProductImagePublicUrl,
  getProductImageStoragePath,
  getProductImageUrl,
  getProductImageVariantPath,
  isDerivedProductImagePath,
  PRODUCT_IMAGE_VARIANTS,
} from '@/lib/product-images'
