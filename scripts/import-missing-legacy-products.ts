/**
 * Imports legacy products that exist on fabricport.com but never made it into Supabase.
 *
 * The July migration ran against a snapshot; products added to the legacy control panel
 * afterwards were simply never picked up. Auditing the panel's authoritative product list
 * (514 rows) against our 465 found 49 gaps -- of which 31 are Active and belong to a real
 * supplier. Beacon Impex was signing in and seeing 30 of their 53 live fabrics.
 *
 * Ownership itself is NOT in question: the same audit compared supplier attribution for all
 * 465 imported products against the panel and found zero mismatches, so this script only
 * ever ADDS rows. It never reassigns an existing one.
 *
 * Caveat worth knowing: these records carry placeholder values in the legacy panel --
 * txtPrice = 1 and txtAvailbleStock = 1. Importing "PKR 1.00" would put 23 one-rupee fabrics
 * on the public marketplace, so prices and stock come in NULL and the products land as
 * `draft`. A supplier sees their own drafts (products_public_read grants owners every row
 * regardless of status), so the inventory page shows all 53 immediately; the supplier prices
 * them and publishes.
 *
 * Usage:
 *   LEGACY_SESSION=<PHPSESSID cookie> npx tsx scripts/import-missing-legacy-products.ts --ids=1256,1257
 *   ... --commit
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ws from 'ws'
import { generateImageVariants, getVariantStoragePaths } from './lib/image-variants.ts'

config({ path: '.env.local' })

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SESSION = process.env.LEGACY_SESSION
if (!URL || !KEY) throw new Error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
if (!SESSION) throw new Error('Missing LEGACY_SESSION (PHPSESSID from an authenticated mscp session)')

const argv = process.argv.slice(2)
const COMMIT = argv.includes('--commit')
const IDS = (argv.find((a) => a.startsWith('--ids='))?.split('=')[1] ?? '')
  .split(',')
  .map((n) => Number(n.trim()))
  .filter(Boolean)
if (IDS.length === 0) throw new Error('Pass --ids=1256,1257,…')

const SUPPLIER_BRAND = argv.find((a) => a.startsWith('--supplier='))?.split('=')[1] ?? 'Beacon Impex'

const BUCKET = 'product-images'
const MSCP = 'https://www.fabricport.com/mscp'
const LEGACY_ORIGINALS = 'https://www.fabricport.com/images/products/originals'

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const execFileAsync = promisify(execFile)

/** curl, not fetch: node's fetch cannot reach fabricport.com from this environment. */
async function get(url: string, headers: string[] = []): Promise<Buffer | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { stdout } = await execFileAsync(
        'curl',
        ['-sfL', '--max-time', '90', '-A', 'FabricPortImport/1.0 (+owner migration)', ...headers, url],
        { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
      )
      if (stdout.length > 0) return stdout
    } catch {
      // 404s land here too.
    }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
  }
  return null
}

const attr = (html: string, name: string): string | null => {
  const m = html.match(new RegExp(`<input[^>]+name="${name}"[^>]*value="([^"]*)"`, 'i'))
  return m ? m[1] : null
}

function selectedOption(html: string, name: string): string | null {
  const block = html.match(new RegExp(`<select[^>]*name="${name}"([\\s\\S]*?)</select>`, 'i'))
  if (!block) return null
  const opt = block[1].match(/<option[^>]*selected[^>]*>([^<]*)<\/option>/i)
  return opt ? opt[1].trim() : null
}

async function main() {
  const { data: supplier, error: supErr } = await db
    .from('suppliers')
    .select('id, brand_name')
    .eq('brand_name', SUPPLIER_BRAND)
    .maybeSingle()
  if (supErr) throw new Error(supErr.message)
  if (!supplier) throw new Error(`No supplier row named "${SUPPLIER_BRAND}"`)

  const { data: categories } = await db.from('fabric_categories').select('id, name')
  const catByName = new Map(
    (categories ?? []).map((c) => [c.name.toLowerCase().trim(), c.id as string]),
  )

  console.log(`supplier: ${supplier.brand_name} (${supplier.id}), products: ${IDS.length}`)
  console.log(COMMIT ? 'COMMIT — writing\n' : 'DRY RUN — pass --commit to write\n')

  const stats = { inserted: 0, skipped: 0, failed: 0, images: 0 }

  for (const legacyId of IDS) {
    try {
      // Never touch a product that is already here. This script only fills gaps.
      const { data: existing } = await db
        .from('products')
        .select('id')
        .eq('legacy_id', legacyId)
        .maybeSingle()
      if (existing) {
        console.log(`  = ${legacyId} already imported`)
        stats.skipped++
        continue
      }

      const page = await get(`${MSCP}/catalog/view-product.php?ProductId=${legacyId}`, [
        '-H', `Cookie: PHPSESSID=${SESSION}`,
        '-H', `Referer: ${MSCP}/catalog/products.php`,
      ])
      if (!page) throw new Error('could not fetch the admin record')
      const html = page.toString('utf8')

      const title = attr(html, 'txtName')
      const sef = attr(html, 'txtSefUrl') ?? ''
      const slug = sef.replace(/\.html$/i, '')
      if (!title || !slug) throw new Error('missing name or SEF url')

      const categoryName = selectedOption(html, 'ddCategory')
      const status = selectedOption(html, 'ddStatus')

      // Picture filenames, in the order the panel lists them.
      const pictures = [...html.matchAll(/<input[^>]+name="Pictures\[\]"[^>]*value="([^"]+)"/gi)]
        .map((m) => m[1])
        .filter(Boolean)

      const row = {
        supplier_id: supplier.id,
        title,
        slug,
        legacy_id: legacyId,
        // Deliberately draft with no price: see the header note about placeholder values.
        status: 'draft',
        visibility: 'public',
        price_min_pkr: null,
        price_max_pkr: null,
        stock_meters: 0,
        category_id: categoryName ? catByName.get(categoryName.toLowerCase()) ?? null : null,
        images: [] as string[],
      }

      console.log(
        `  + ${legacyId} ${title} (${categoryName ?? 'no category'}, legacy status ${status}) — ${pictures.length} image(s)`,
      )
      if (!COMMIT) continue

      // Upload images first so the product row is never published pointing at nothing.
      const keys: string[] = []
      for (const filename of pictures) {
        const buffer = await get(`${LEGACY_ORIGINALS}/${encodeURIComponent(filename)}`)
        if (!buffer) {
          console.warn(`    ! no original for ${filename}`)
          continue
        }
        const key = `${slug}/${filename}`
        const up = await db.storage.from(BUCKET).upload(key, buffer, {
          contentType: filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg',
          upsert: true,
          cacheControl: '3600',
        })
        if (up.error) {
          console.warn(`    ! upload ${key}: ${up.error.message}`)
          continue
        }
        const variants = await generateImageVariants(buffer)
        const paths = getVariantStoragePaths(key)
        for (const v of ['card', 'medium', 'large'] as const) {
          await db.storage.from(BUCKET).upload(paths[v], variants[v], {
            contentType: 'image/webp',
            upsert: true,
            cacheControl: '3600',
          })
        }
        keys.push(key)
        stats.images++
      }
      row.images = keys

      const { error } = await db.from('products').insert(row)
      if (error) throw new Error(error.message)
      stats.inserted++
    } catch (err) {
      stats.failed++
      console.warn(`  ! ${legacyId}: ${(err as Error).message}`)
    }
  }

  console.log(`\n${JSON.stringify({ committed: COMMIT, ...stats }, null, 1)}`)
}

await main()
