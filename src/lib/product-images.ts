/** Stored derivative sizes (industry-standard listing / gallery breakpoints). */
export const PRODUCT_IMAGE_VARIANTS = {
  /** Marketplace grid, compact rows, detail thumbs (~480px, WebP). */
  card: { width: 480, quality: 80 },
  /** Detail hero, featured tiles (~960px, WebP). */
  medium: { width: 960, quality: 82 },
  /**
   * Detail hero at 2x DPR and the zoom lens (~1600px, WebP).
   *
   * 1600 rather than 1920: the hero is 50vw above 1024px, so a 1440 viewport asks for
   * 720 CSS px -> 1440 device px at 2x, and 1600 also covers the 2.2x magnifier lens.
   * Most repaired legacy originals top out at 1080-1320 anyway, and
   * `withoutEnlargement` makes this tier self-limiting for them.
   */
  large: { width: 1600, quality: 82 },
} as const

export type ProductImageVariant = keyof typeof PRODUCT_IMAGE_VARIANTS | 'original'

export interface ProductImageOptions {
  variant?: ProductImageVariant
}

export function isDerivedProductImagePath(path: string): boolean {
  // Must list EVERY variant name. A missing one is treated as an original, which then
  // gets a derived path of its own -- `foo.thumb.large.thumb.card.webp`.
  return /\.thumb\.(card|medium|large)\.webp$/i.test(path)
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

/**
 * Public URL for a `.zfab` digital fabric in the `digital-fabrics` bucket.
 *
 * Stored on `products.scan_files` as `<productId>/<filename>.zfab`. An absolute URL is
 * passed through untouched so a product can point at an external host without a migration.
 */
export function getDigitalFabricUrl(path: string): string {
  if (path.startsWith('http')) return path
  const base = import.meta.env.VITE_SUPABASE_URL
  return `${base}/storage/v1/object/public/digital-fabrics/${path}`
}

/** Filename shown on the download button. */
export function getDigitalFabricName(path: string): string {
  const last = path.split('/').pop() ?? path
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}
