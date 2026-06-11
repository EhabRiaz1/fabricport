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

  const [card, medium] = await Promise.all([
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
  ])

  return { card, medium }
}

export function getVariantStoragePaths(originalPath: string): Record<StoredImageVariant, string> {
  return {
    card: getProductImageVariantPath(originalPath, 'card'),
    medium: getProductImageVariantPath(originalPath, 'medium'),
  }
}
