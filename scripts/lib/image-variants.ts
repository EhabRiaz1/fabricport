import sharp from 'sharp'
import {
  getProductImageVariantPath,
  PRODUCT_IMAGE_VARIANTS,
} from '../../src/lib/product-images.ts'

export { getProductImageVariantPath, PRODUCT_IMAGE_VARIANTS }

export type StoredImageVariant = keyof typeof PRODUCT_IMAGE_VARIANTS

export async function generateImageVariants(
  input: Buffer,
): Promise<Record<StoredImageVariant, Buffer>> {
  const pipeline = sharp(input).rotate()

  const [card, medium, large] = await Promise.all([
    pipeline
      .clone()
      .resize({
        width: PRODUCT_IMAGE_VARIANTS.card.width,
        withoutEnlargement: true,
      })
      .webp({ quality: PRODUCT_IMAGE_VARIANTS.card.quality })
      .toBuffer(),
    pipeline
      .clone()
      .resize({
        width: PRODUCT_IMAGE_VARIANTS.medium.width,
        withoutEnlargement: true,
      })
      .webp({ quality: PRODUCT_IMAGE_VARIANTS.medium.quality })
      .toBuffer(),
    pipeline
      .clone()
      .resize({
        width: PRODUCT_IMAGE_VARIANTS.large.width,
        // Never upscale. For a legacy original that is only 1080px wide, `large` simply
        // comes out at 1080 -- correct, and the reason a repaired original must be
        // uploaded BEFORE variants are regenerated.
        withoutEnlargement: true,
      })
      .webp({ quality: PRODUCT_IMAGE_VARIANTS.large.quality })
      .toBuffer(),
  ])

  return { card, medium, large }
}

export function getVariantStoragePaths(originalPath: string): Record<StoredImageVariant, string> {
  return {
    card: getProductImageVariantPath(originalPath, 'card'),
    medium: getProductImageVariantPath(originalPath, 'medium'),
    large: getProductImageVariantPath(originalPath, 'large'),
  }
}
