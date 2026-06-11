/**
 * Back-fill `color_hex` and `color_family` on published products by sampling
 * the dominant colour of each product's primary scan image.
 *
 * Usage: npx tsx scripts/classify-colors.ts
 * Requires: .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import ws from 'ws'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'product-images'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

type ColorFamily =
  | 'black' | 'white' | 'gray' | 'beige' | 'brown' | 'red'
  | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink'

function toHsl(r: number, g: number, b: number) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  let h = 0
  const l = ((max + min) / 2) * 100
  let s = 0
  if (delta !== 0) {
    s = l < 50 ? (delta / (max + min)) * 100 : (delta / (2 - max - min)) * 100
    switch (max) {
      case rn: h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) * 60; break
      case gn: h = ((bn - rn) / delta + 2) * 60; break
      default: h = ((rn - gn) / delta + 4) * 60
    }
  }
  return { h: Number.isNaN(h) ? 0 : h, s, l }
}

// Mirrors src/lib/color/classify.ts so app + data agree.
function classify(r: number, g: number, b: number): ColorFamily {
  const { h, s, l } = toHsl(r, g, b)
  if (s < 12) {
    if (l < 15) return 'black'
    if (l > 85) return 'white'
    return 'gray'
  }
  if (h >= 15 && h < 45 && l < 55 && s < 40) return 'brown'
  if (h >= 35 && h < 55 && l > 70 && s < 35) return 'beige'
  if (h >= 345 || h < 15) return 'red'
  if (h >= 15 && h < 45) return 'orange'
  if (h >= 45 && h < 70) return 'yellow'
  if (h >= 70 && h < 160) return 'green'
  if (h >= 160 && h < 280) return 'blue'
  if (h >= 280 && h < 320) return 'purple'
  return 'pink'
}

function variantPath(originalPath: string): string {
  const dot = originalPath.lastIndexOf('.')
  const base = dot === -1 ? originalPath : originalPath.slice(0, dot)
  return `${base}.thumb.card.webp`
}

async function sampleDominantColor(buffer: Buffer): Promise<{ r: number; g: number; b: number }> {
  // Crop to the center 60% to avoid mat/background borders on scan photos,
  // then average a small grid of pixels.
  const image = sharp(buffer)
  const meta = await image.metadata()
  const w = meta.width ?? 100
  const h = meta.height ?? 100
  const region = {
    left: Math.floor(w * 0.2),
    top: Math.floor(h * 0.2),
    width: Math.floor(w * 0.6),
    height: Math.floor(h * 0.6),
  }
  const { data } = await image
    .extract(region)
    .resize(8, 8, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let r = 0
  let g = 0
  let b = 0
  const pixels = data.length / 3
  for (let i = 0; i < data.length; i += 3) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  return { r: Math.round(r / pixels), g: Math.round(g / pixels), b: Math.round(b / pixels) }
}

async function main() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, title, images, color_family')
    .eq('status', 'published')

  if (error) throw new Error(error.message)

  let done = 0
  let failed = 0
  const counts: Record<string, number> = {}

  for (const product of products ?? []) {
    const images = (product.images ?? []) as string[]
    const first = images[0]
    if (!first) {
      failed++
      continue
    }

    const path = first.startsWith('http') ? null : variantPath(first)
    const url = path
      ? `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
      : first

    try {
      let res = await fetch(url!)
      if (!res.ok && path) {
        // Derivative missing — fall back to the original upload.
        res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${first}`)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const buffer = Buffer.from(await res.arrayBuffer())
      const { r, g, b } = await sampleDominantColor(buffer)
      const family = classify(r, g, b)
      const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`

      const { error: updateError } = await supabase
        .from('products')
        .update({ color_hex: hex, color_family: family })
        .eq('id', product.id)

      if (updateError) throw new Error(updateError.message)
      counts[family] = (counts[family] ?? 0) + 1
      done++
      if (done % 25 === 0) console.log(`…${done} classified`)
    } catch (err) {
      failed++
      console.warn(`✗ ${product.title}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nDone. ${done} classified, ${failed} failed.`)
  console.log(counts)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
