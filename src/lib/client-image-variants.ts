import {
  getProductImageVariantPath,
  PRODUCT_IMAGE_VARIANTS,
  type ProductImageVariant,
} from '@/lib/product-images'

export type ClientImageVariant = Exclude<ProductImageVariant, 'original'>

export interface GeneratedClientImageVariant {
  variant: ClientImageVariant
  path: string
  blob: Blob
}

async function createWebpVariant(
  file: File,
  maxWidth: number,
  quality: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not prepare image canvas')
  }

  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('Could not encode WebP variant'))
          return
        }
        resolve(result)
      },
      'image/webp',
      quality / 100,
    )
  })

  return blob
}

/** Build card + medium WebP blobs for a newly uploaded original. */
export async function generateClientImageVariants(
  file: File,
  originalPath: string,
): Promise<GeneratedClientImageVariant[]> {
  const entries = Object.entries(PRODUCT_IMAGE_VARIANTS) as Array<
    [ClientImageVariant, (typeof PRODUCT_IMAGE_VARIANTS)[ClientImageVariant]]
  >

  const variants = await Promise.all(
    entries.map(async ([variant, config]) => ({
      variant,
      path: getProductImageVariantPath(originalPath, variant),
      blob: await createWebpVariant(file, config.width, config.quality),
    })),
  )

  return variants
}
