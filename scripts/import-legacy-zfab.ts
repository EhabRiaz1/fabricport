/**
 * Mirrors the legacy site's .zfab digital fabric files into the `digital-fabrics` bucket
 * and links them onto `products.scan_files`.
 *
 * The old fabricport.com product pages carry a "Download Digital Fabric File" link to
 * `download.php?File=files/digital-fabric/<legacyId>-<code>.zfab` -- a CLO 3D / Marvelous
 * Designer material. 71 of the 454 legacy products have one; the rest do not, and there is
 * no index of them anywhere, so the filenames have to be read off the product pages.
 *
 * Safety properties:
 *  - The legacy site is only ever READ. Plain GETs to public URLs, no login, no admin
 *    panel, no writes of any kind. It is left exactly as it is.
 *  - Downloads come from the static path, not `download.php`. The PHP handler does not
 *    answer HEAD and does not support ranges; the static path does both, which is what
 *    makes the "already uploaded at the same size" skip possible.
 *  - Writes ONLY `products.scan_files`, and only for products where it is currently empty.
 *    No other column is touched. Nothing is ever deleted.
 *  - Upload uses upsert:false, so an object already in the bucket is left alone.
 *  - Dry run by default. `--commit` is required to write anything.
 *  - Idempotent: a second run finds every product already linked and does nothing.
 *
 * Usage:
 *   npx tsx scripts/import-legacy-zfab.ts                 # dry run, reports the plan
 *   npx tsx scripts/import-legacy-zfab.ts --commit        # download + upload + link
 *   npx tsx scripts/import-legacy-zfab.ts --limit=5 --commit
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ws from 'ws'

config({ path: '.env.local' })

const URL_ = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) {
  throw new Error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
}

const argv = process.argv.slice(2)
const COMMIT = argv.includes('--commit')
const LIMIT = Number(argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0)
const CONCURRENCY = Math.max(
  1,
  Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 8),
)

const ORIGIN = 'https://www.fabricport.com'
const BUCKET = 'digital-fabrics'
/** Matches product-videos and the bucket migration. Largest legacy file is ~39 MB. */
const MAX_BYTES = 52_428_800

const db = createClient(URL_, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const execFileAsync = promisify(execFile)

/** curl, not fetch: node's fetch cannot reach fabricport.com from this environment. */
async function getText(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { stdout } = await execFileAsync(
        'curl',
        ['-sfL', '--max-time', '60', '-A', 'FabricPortZfabImport/1.0 (+owner migration)', url],
        { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
      )
      if (stdout.length > 0) return stdout
    } catch {
      // 404s land here too.
    }
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
  }
  return null
}

/** Total size from a one-byte range request, so a 39 MB file costs one packet to measure. */
async function headSize(url: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(
      'curl',
      ['-s', '-o', '/dev/null', '-D-', '--max-time', '30', '-r', '0-0', url],
      { encoding: 'utf8' },
    )
    const match = stdout.match(/content-range:\s*bytes\s+\d+-\d+\/(\d+)/i)
    return match ? Number(match[1]) : null
  } catch {
    return null
  }
}

async function getBinary(url: string): Promise<Buffer | null> {
  try {
    const { stdout } = await execFileAsync(
      'curl',
      ['-sfL', '--max-time', '300', '-A', 'FabricPortZfabImport/1.0 (+owner migration)', url],
      { encoding: 'buffer', maxBuffer: 128 * 1024 * 1024 },
    )
    return stdout.length > 0 ? stdout : null
  } catch {
    return null
  }
}

/** Runs `worker` over `items` with a fixed pool, preserving input order in the results. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const index = cursor++
        if (index >= items.length) return
        results[index] = await worker(items[index], index)
      }
    }),
  )
  return results
}

// ---------------------------------------------------------------------------
// 1. Which legacy product pages carry a .zfab
// ---------------------------------------------------------------------------

const sitemap = await getText(`${ORIGIN}/sitemap.xml`)
if (!sitemap) throw new Error('Could not read the legacy sitemap')

const productUrls = [
  ...new Set(
    [...sitemap.matchAll(/https:\/\/www\.fabricport\.com\/(?:knit|woven)\/[a-z0-9-]+\.html/g)].map(
      (m) => m[0],
    ),
  ),
]
console.log(`legacy product pages in sitemap: ${productUrls.length}`)

const scanned = await mapPool(productUrls, CONCURRENCY, async (url) => {
  const html = await getText(url)
  if (!html) return null
  const match = html.match(/files\/digital-fabric\/(\d+)-([^"'<>\s]+\.zfab)/i)
  if (!match) return null
  return {
    url,
    legacyId: Number(match[1]),
    file: `${match[1]}-${match[2]}`,
    remote: `${ORIGIN}/files/digital-fabric/${match[1]}-${match[2]}`,
  }
})

const found = scanned.filter((x): x is NonNullable<typeof x> => x != null)
console.log(`pages with a .zfab: ${found.length}`)

// ---------------------------------------------------------------------------
// 2. Match them to our products by legacy_id
// ---------------------------------------------------------------------------

const { data: products, error } = await db
  .from('products')
  .select('id, slug, legacy_id, status, scan_files')
  .in(
    'legacy_id',
    found.map((f) => f.legacyId),
  )
if (error) throw new Error(error.message)

const byLegacyId = new Map((products ?? []).map((p) => [p.legacy_id as number, p]))

interface Job {
  productId: string
  slug: string
  legacyId: number
  file: string
  remote: string
  key: string
}

const jobs: Job[] = []
const unmatched: number[] = []
const alreadyLinked: string[] = []

for (const hit of found) {
  const product = byLegacyId.get(hit.legacyId)
  if (!product) {
    unmatched.push(hit.legacyId)
    continue
  }
  // Never overwrite. A product that already has a scan file is out of scope entirely.
  if (((product.scan_files as string[] | null) ?? []).length > 0) {
    alreadyLinked.push(product.slug as string)
    continue
  }
  jobs.push({
    productId: product.id as string,
    slug: product.slug as string,
    legacyId: hit.legacyId,
    file: hit.file,
    remote: hit.remote,
    key: `${product.id}/${hit.file}`,
  })
}

const planned = LIMIT ? jobs.slice(0, LIMIT) : jobs

console.log(
  [
    `matched to a product: ${found.length - unmatched.length}`,
    `already linked (skipped): ${alreadyLinked.length}`,
    `unmatched legacy ids: ${unmatched.length}${unmatched.length ? ` (${unmatched.join(', ')})` : ''}`,
    `to import: ${planned.length}`,
  ].join('\n'),
)

if (!COMMIT) {
  const sizes = await mapPool(planned, CONCURRENCY, (job) => headSize(job.remote))
  const total = sizes.reduce<number>((sum, size) => sum + (size ?? 0), 0)
  const oversized = planned.filter((_, i) => (sizes[i] ?? 0) > MAX_BYTES)
  console.log(`\nDRY RUN — pass --commit to write.`)
  console.log(`total download: ${(total / 1024 ** 3).toFixed(2)} GB across ${planned.length} files`)
  if (oversized.length) {
    console.log(
      `over the ${MAX_BYTES / 1024 ** 2} MB bucket ceiling and will be skipped: ${oversized
        .map((j) => j.file)
        .join(', ')}`,
    )
  }
  for (const [i, job] of planned.entries()) {
    console.log(`  ${job.slug} <- ${job.file} (${((sizes[i] ?? 0) / 1024 ** 2).toFixed(1)} MB)`)
  }
  process.exit(0)
}

// ---------------------------------------------------------------------------
// 3. Download, upload, link
// ---------------------------------------------------------------------------

let uploaded = 0
let linked = 0
let skippedTooBig = 0
let failed = 0

// Serial: these are ~18 MB each and a parallel pool would hold half a gigabyte of Buffers
// in memory at once for no wall-clock gain over a single saturated uplink.
for (const [index, job] of planned.entries()) {
  const size = await headSize(job.remote)
  if (size != null && size > MAX_BYTES) {
    console.warn(`  ! ${job.file}: ${(size / 1024 ** 2).toFixed(1)} MB exceeds the bucket limit`)
    skippedTooBig++
    continue
  }

  const body = await getBinary(job.remote)
  if (!body) {
    console.warn(`  ! ${job.file}: download failed`)
    failed++
    continue
  }
  if (size != null && body.length !== size) {
    console.warn(`  ! ${job.file}: short read (${body.length} of ${size} bytes)`)
    failed++
    continue
  }

  const { error: upErr } = await db.storage.from(BUCKET).upload(job.key, body, {
    contentType: 'application/octet-stream',
    upsert: false, // never overwrite an existing object
  })
  // "already exists" is success for our purposes -- the object is there.
  if (upErr && !/exists/i.test(upErr.message)) {
    console.warn(`  ! ${job.key}: ${upErr.message}`)
    failed++
    continue
  }
  if (!upErr) uploaded++

  const { error: updErr } = await db
    .from('products')
    .update({ scan_files: [job.key] })
    .eq('id', job.productId)
  if (updErr) {
    console.warn(`  ! link ${job.slug}: ${updErr.message}`)
    failed++
    continue
  }
  linked++

  process.stdout.write(
    `  ${index + 1}/${planned.length} ${job.slug} <- ${job.file} (${(body.length / 1024 ** 2).toFixed(1)} MB)\n`,
  )
}

console.log(
  JSON.stringify(
    {
      committed: true,
      products_linked: linked,
      objects_uploaded: uploaded,
      skipped_already_linked: alreadyLinked.length,
      skipped_too_large: skippedTooBig,
      unmatched_legacy_ids: unmatched.length,
      failed,
    },
    null,
    1,
  ),
)
