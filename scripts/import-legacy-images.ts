/**
 * Uploads the legacy product images into the `product-images` bucket and links
 * them onto the imported products.
 *
 * Safety properties:
 *  - Only touches products whose `images` array is currently EMPTY. Products that
 *    already have images (the original 205 seeded ones) are never modified.
 *  - Upload uses upsert:false, so an object that already exists is left alone.
 *  - Deletes nothing, ever.
 *
 * Usage: LEGACY_DATA_DIR=<dir> npx tsx scripts/import-legacy-images.ts [--commit]
 * Without --commit it reports what it would do and writes nothing.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import ws from 'ws'

config({ path: '.env.local' })

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATA = process.env.LEGACY_DATA_DIR
const COMMIT = process.argv.includes('--commit')
if (!URL || !KEY || !DATA) throw new Error('Missing env: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / LEGACY_DATA_DIR')

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const BUCKET = 'product-images'
const CONTENT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
}

interface Legacy { legacy_id: number; slug: string; images: string[] }

const legacy: Legacy[] = JSON.parse(readFileSync(`${DATA}/legacy-products.json`, 'utf8'))
const bySlug = new Map(legacy.map((p) => [p.slug, p]))

const { data: products, error } = await db
  .from('products')
  .select('id, slug, images')
  .not('legacy_id', 'is', null)
if (error) throw new Error(error.message)

// Only products with NO images. Anything already populated is out of scope.
const targets = (products ?? []).filter((p) => (p.images as string[]).length === 0)
console.log(`legacy-linked products: ${products?.length}, with no images: ${targets.length}`)
if (!COMMIT) console.log('DRY RUN — pass --commit to write\n')

let uploaded = 0, linked = 0, missingFile = 0, failed = 0

for (const p of targets) {
  const src = bySlug.get(p.slug)
  if (!src || src.images.length === 0) continue

  const keys: string[] = []
  for (const url of src.images) {
    const fn = url.split('/').pop()!
    const path = `${DATA}/imgs/${fn}`
    if (!existsSync(path)) { missingFile++; continue }

    const key = `${p.slug}/${fn}`
    if (COMMIT) {
      const body = readFileSync(path)
      const ext = fn.split('.').pop()!.toLowerCase()
      const { error: upErr } = await db.storage.from(BUCKET).upload(key, body, {
        contentType: CONTENT[ext] ?? 'application/octet-stream',
        upsert: false, // never overwrite an existing object
      })
      // "already exists" is success for our purposes — the object is there.
      if (upErr && !/exists/i.test(upErr.message)) {
        console.warn(`  ! ${key}: ${upErr.message}`)
        failed++
        continue
      }
      uploaded++
    }
    keys.push(key)
  }

  if (keys.length && COMMIT) {
    const { error: updErr } = await db.from('products').update({ images: keys }).eq('id', p.id)
    if (updErr) { console.warn(`  ! link ${p.slug}: ${updErr.message}`); failed++; continue }
  }
  if (keys.length) linked++
  if (linked % 50 === 0 && keys.length) process.stdout.write(`  …${linked} products\n`)
}

console.log(JSON.stringify({ committed: COMMIT, products_linked: linked, objects_uploaded: uploaded, local_file_missing: missingFile, failed }, null, 1))
