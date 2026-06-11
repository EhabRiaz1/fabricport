/** Stored derivative sizes (industry-standard listing / gallery breakpoints). */
export const PRODUCT_IMAGE_VARIANTS = {
  /** Marketplace grid, compact rows, detail thumbs (~480px, WebP). */
  card: { width: 480, quality: 80 },
  /** Detail hero, featured tiles (~960px, WebP). */
  medium: { width: 960, quality: 82 },
} as const

export type ProductImageVariant = keyof typeof PRODUCT_IMAGE_VARIANTS | 'original'

export interface ProductImageOptions {
  variant?: ProductImageVariant
}

export function isDerivedProductImagePath(path: string): boolean {
  return /\.thumb\.(card|medium)\.webp$/i.test(path)
}

/** Deterministic storage path for a pre-generated WebP derivative. */
export function getProductImageVariantPath(
  originalPath: string,
  variant: keyof typeof PRODUCT_IMAGE_VARIANTS,
): string {
  if (isDerivedProductImagePath(originalPath)) return originalPath

  const dot = originalPath.lastIndexOf('.')
  const base = dot === -1 ? originalPath : originalPath.slice(0, dot)
  return `${base}.thumb.${variant}.webp`
}

export function getProductImageStoragePath(
  path: string,
  variant: ProductImageVariant = 'original',
): string {
  if (path.startsWith('http') || isDerivedProductImagePath(path)) return path
  if (variant === 'original') return path
  return getProductImageVariantPath(path, variant)
}

export function getProductImagePublicUrl(storagePath: string): string {
  if (storagePath.startsWith('http')) return storagePath
  const base = import.meta.env.VITE_SUPABASE_URL
  return `${base}/storage/v1/object/public/product-images/${storagePath}`
}

export function getProductImageOriginalUrl(path: string): string {
  return getProductImagePublicUrl(getProductImageStoragePath(path, 'original'))
}

export function getProductImageUrl(path: string, options?: ProductImageOptions): string {
  const variant = options?.variant ?? 'original'
  return getProductImagePublicUrl(getProductImageStoragePath(path, variant))
}
