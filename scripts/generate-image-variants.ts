import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import { isDerivedProductImagePath } from '../src/lib/product-images.ts'
import {
  generateImageVariants,
  getVariantStoragePaths,
} from './lib/image-variants.ts'

config({ path: '.env.local' })

const BUCKET = 'product-images'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

const supabase = createClient(
  requireEnv('VITE_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  {
    global: {
      fetch: (...args) => fetch(...args),
    },
    realtime: { transport: ws },
  },
)

function isProcessableImage(buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  // JPEG, PNG, WebP, GIF
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return true
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return true
  }
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return true
  }
  return false
}

function log(label: string, message: string) {
  console.log(`[${label}] ${message}`)
}

async function uploadVariants(originalPath: string, source: Buffer) {
  const variants = await generateImageVariants(source)
  const paths = getVariantStoragePaths(originalPath)

  for (const variant of ['card', 'medium'] as const) {
    const { error } = await supabase.storage.from(BUCKET).upload(paths[variant], variants[variant], {
      contentType: 'image/webp',
      upsert: true,
    })

    if (error) {
      throw new Error(`upload failed for ${paths[variant]}: ${error.message}`)
    }
  }
}

async function collectOriginalPaths(): Promise<string[]> {
  const { data, error } = await supabase.from('products').select('images')
  if (error) throw new Error(error.message)

  const paths = new Set<string>()
  for (const row of data ?? []) {
    for (const imagePath of (row.images as string[] | null) ?? []) {
      if (!imagePath || isDerivedProductImagePath(imagePath)) continue
      paths.add(imagePath)
    }
  }

  return [...paths]
}

async function main() {
  const filterPath = process.argv.find((arg) => arg.startsWith('--path='))?.slice('--path='.length)
  const originals = filterPath ? [filterPath] : await collectOriginalPaths()

  log('start', `${originals.length} original image(s) to process`)

  let processed = 0
  let skipped = 0
  let failed = 0

  for (const originalPath of originals) {
    try {
      const paths = getVariantStoragePaths(originalPath)
      const checks = await Promise.all([
        supabase.storage.from(BUCKET).download(originalPath),
        supabase.storage.from(BUCKET).download(paths.card),
      ])

      const original = checks[0]
      if (original.error || !original.data) {
        log('missing', originalPath)
        skipped++
        continue
      }

      if (!checks[1].error && checks[1].data) {
        log('skip', `${originalPath} (variants exist)`)
        skipped++
        continue
      }

      const buffer = Buffer.from(await original.data.arrayBuffer())
      if (!isProcessableImage(buffer)) {
        log('skip', `${originalPath} (not a supported image file)`)
        skipped++
        continue
      }

      await uploadVariants(originalPath, buffer)
      processed++
      log('ok', originalPath)
    } catch (err) {
      failed++
      log(
        'error',
        `${originalPath}: ${err instanceof Error ? err.message : 'unknown error'}`,
      )
    }
  }

  log(
    'done',
    `processed=${processed} skipped=${skipped} failed=${failed}`,
  )

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
