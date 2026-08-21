/**
 * Repairs the legacy product images that were imported at thumbnail resolution.
 *
 * What went wrong: the out-of-repo extraction step downloaded from
 * fabricport.com/images/products/THUMBS/ instead of /ORIGINALS/. Every one of those files
 * is 240x300. `sharp` then correctly refused to upscale them, so the "960px medium" and
 * "480px card" derivatives are also 240px -- the detail page serves a 1.8 KB WebP.
 * Verified byte-for-byte: storage's `2-thread-terry/226-71-render-1.jpg` is 19,527 bytes,
 * the legacy thumb is 19,527 bytes, the legacy original is 245,702 bytes at 1080x1080.
 *
 * For every image this picks the highest-resolution source available among:
 *   1. the local scrape folder (up to 3000x3000, ~408 files)
 *   2. https://www.fabricport.com/images/products/originals/<file>  (public, no auth)
 *   3. whatever is in Supabase storage right now
 * and, if the winner beats the incumbent, replaces the storage object and regenerates all
 * three variants.
 *
 * Safety properties:
 *  - Dry run by default. `--commit` is required to write anything.
 *  - NEVER downgrades: if the current object is already the largest, it is skipped.
 *  - NEVER touches `products.images`. Storage paths are unchanged, so a half-finished run
 *    leaves nothing incoherent and the whole operation stays revertible.
 *  - Originals upload BEFORE their variants, so a crash between the two leaves a good
 *    original with stale-but-valid variants, which FabricCard's variant->original onError
 *    fallback already covers.
 *  - Idempotent. A second `--commit` run must report `replaced: 0`.
 *
 * Note `upsert: true` below. `import-legacy-images.ts` used `upsert: false`, which is
 * precisely why the thumbnails are stuck in place -- a naive re-run is a silent no-op.
 *
 * Usage:
 *   npx tsx scripts/repair-product-images.ts --audit          # report only, no downloads of losers
 *   npx tsx scripts/repair-product-images.ts                  # dry run, full source comparison
 *   npx tsx scripts/repair-product-images.ts --commit         # write
 *   npx tsx scripts/repair-product-images.ts --commit --slug=2-thread-terry
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'
import ws from 'ws'
import {
  generateImageVariants,
  getVariantStoragePaths,
} from './lib/image-variants.ts'
import { isDerivedProductImagePath } from '../src/lib/product-images.ts'

config({ path: '.env.local' })

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) throw new Error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

const BUCKET = 'product-images'
const LEGACY_ORIGINALS = 'https://www.fabricport.com/images/products/originals'
const LOCAL_DIR =
  process.env.LOCAL_IMAGE_DIR ??
  '/Users/ehabriaz/Desktop/FP&LM/fabricport/public/images/products'

const argv = process.argv.slice(2)
const has = (f: string) => argv.includes(f)
const val = (f: string) => argv.find((a) => a.startsWith(`${f}=`))?.split('=')[1]

// --audit is report-only by construction: it probes every source but never writes.
const COMMIT = has('--commit') && !has('--audit')
const AUDIT = has('--audit')
const ONLY_SLUG = val('--slug')
const LIMIT = Number(val('--limit') ?? 0)
const LOG = val('--log') ?? 'image-repair.jsonl'
const CONCURRENCY = Math.max(1, Number(val('--concurrency') ?? 5))

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const CONTENT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
}

interface Candidate {
  source: 'local' | 'legacy' | 'current'
  buffer: Buffer
  width: number
  height: number
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The legacy /originals/ endpoint serves one size per filename, and everything it has is at
 * least 1000px on its short edge (observed: 1080x1080 and 1320x1080). So if what we already
 * hold is comfortably above thumbnail territory, we already have the legacy original or
 * better and re-downloading it cannot improve anything.
 *
 * This is what makes a full run take minutes instead of hours, and -- unlike a pixel-area
 * ceiling -- it also makes a SECOND run cheap, because the images this script just repaired
 * no longer qualify for another probe.
 */
const LEGACY_SHORT_EDGE_FLOOR = 1000

async function measure(
  source: Candidate['source'],
  buffer: Buffer | null,
): Promise<Candidate | null> {
  if (!buffer || buffer.length === 0) return null
  try {
    const meta = await sharp(buffer).metadata()
    if (!meta.width || !meta.height) return null
    return { source, buffer, width: meta.width, height: meta.height }
  } catch {
    // Not a decodable image (the legacy host serves an HTML 404 body with a 200 in a
    // couple of cases). Treat as absent rather than crashing the run.
    return null
  }
}

const execFileAsync = promisify(execFile)

/**
 * Pulls one legacy original.
 *
 * Uses curl rather than global fetch on purpose: node's fetch cannot reach
 * www.fabricport.com from this environment (ETIMEDOUT on both A and AAAA records) while
 * curl connects fine, so the undici path would silently report every legacy original as
 * absent and the whole repair would no-op. `-f` turns a non-2xx into a non-zero exit;
 * anything that is not a decodable image is rejected by measure() downstream anyway.
 */
async function fetchLegacy(filename: string): Promise<Buffer | null> {
  // Retry, because a transient failure here is indistinguishable from "this file does not
  // exist upstream" and silently degrades to leaving a 240x300 thumbnail in place. One run
  // lost a genuinely available 1320x1080 original exactly this way.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { stdout } = await execFileAsync(
        'curl',
        [
          '-sfL',
          '--max-time', '90',
          '--retry', '2',
          '--retry-delay', '1',
          '-A', 'FabricPortImageRepair/1.0 (+owner migration)',
          `${LEGACY_ORIGINALS}/${encodeURIComponent(filename)}`,
        ],
        { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
      )
      if (stdout.length > 0) return stdout
    } catch {
      // 404 also lands here; the backoff below costs a few seconds on a genuine miss.
    }
    await sleep(500 * (attempt + 1))
  }
  return null
}

async function main() {
  let query = db.from('products').select('id, slug, images').not('images', 'is', null)
  if (ONLY_SLUG) query = query.eq('slug', ONLY_SLUG)
  const { data: products, error } = await query
  if (error) throw new Error(error.message)

  // Only real originals. A derived path has no upstream source to repair.
  const targets: { slug: string; path: string; filename: string }[] = []
  for (const p of products ?? []) {
    for (const path of (p.images as string[]) ?? []) {
      if (isDerivedProductImagePath(path) || path.startsWith('http')) continue
      const filename = path.split('/').pop()
      if (!filename) continue
      targets.push({ slug: p.slug, path, filename })
    }
  }
  const work = LIMIT > 0 ? targets.slice(0, LIMIT) : targets

  console.log(
    `products: ${products?.length ?? 0}, original image objects: ${targets.length}` +
      (LIMIT ? ` (limited to ${work.length})` : ''),
  )
  console.log(COMMIT ? 'COMMIT — writing\n' : 'DRY RUN — pass --commit to write\n')

  const stats = { replaced: 0, skipped: 0, missing: 0, failed: 0, fromLocal: 0, fromLegacy: 0 }
  const before: number[] = []
  const after: number[] = []
  let done = 0
  let cursor = 0

  const processOne = async (t: (typeof work)[number]) => {
    try {
      const dl = await db.storage.from(BUCKET).download(t.path)
      const currentBuf = dl.data ? Buffer.from(await dl.data.arrayBuffer()) : null
      const current = await measure('current', currentBuf)
      if (!current) {
        stats.missing++
        return
      }
      before.push(current.width * current.height)

      const localPath = `${LOCAL_DIR}/${t.filename}`
      const local = existsSync(localPath)
        ? await measure('local', readFileSync(localPath))
        : null

      // Only reach out to the legacy host when it could actually help.
      let legacy: Candidate | null = null
      const bestShortEdge = Math.max(
        Math.min(current.width, current.height),
        local ? Math.min(local.width, local.height) : 0,
      )
      // --audit always probes: knowing the true ceiling for every image is the point of an
      // audit, even where the legacy copy cannot win.
      if (AUDIT || bestShortEdge < LEGACY_SHORT_EDGE_FLOOR) {
        legacy = await measure('legacy', await fetchLegacy(t.filename))
        await sleep(120) // be polite to the legacy host
      }

      const candidates = [current, local, legacy].filter(Boolean) as Candidate[]
      const winner = candidates.reduce((best, c) => {
        const bp = best.width * best.height
        const cp = c.width * c.height
        if (cp !== bp) return cp > bp ? c : best
        // Same pixel count: prefer the bigger file, i.e. the less-recompressed one.
        return c.buffer.length > best.buffer.length ? c : best
      })

      const gained = winner.width * winner.height > current.width * current.height
      const line = {
        path: t.path,
        current: `${current.width}x${current.height}`,
        local: local ? `${local.width}x${local.height}` : null,
        legacy: legacy ? `${legacy.width}x${legacy.height}` : null,
        winner: winner.source,
        chosen: `${winner.width}x${winner.height}`,
        action: gained ? (COMMIT ? 'replaced' : 'would-replace') : 'skip',
      }
      appendFileSync(LOG, `${JSON.stringify(line)}\n`)

      if (!gained) {
        stats.skipped++
        after.push(current.width * current.height)
        return
      }
      after.push(winner.width * winner.height)
      if (winner.source === 'local') stats.fromLocal++
      if (winner.source === 'legacy') stats.fromLegacy++

      if (COMMIT) {
        const ext = t.filename.split('.').pop()!.toLowerCase()
        const up = await db.storage.from(BUCKET).upload(t.path, winner.buffer, {
          contentType: CONTENT[ext] ?? 'application/octet-stream',
          // The whole point. import-legacy-images.ts used upsert:false, which is why the
          // thumbnails never got replaced.
          upsert: true,
          // Deliberately one hour, not a year: the storage path does not change, so
          // browsers and the CDN still hold the old thumbnail. A short TTL clears the
          // transition; raise it once the repair has propagated.
          cacheControl: '3600',
        })
        if (up.error) throw new Error(`upload original: ${up.error.message}`)

        const variants = await generateImageVariants(winner.buffer)
        const paths = getVariantStoragePaths(t.path)
        for (const v of ['card', 'medium', 'large'] as const) {
          const r = await db.storage.from(BUCKET).upload(paths[v], variants[v], {
            contentType: 'image/webp',
            upsert: true,
            cacheControl: '3600',
          })
          if (r.error) throw new Error(`upload ${v}: ${r.error.message}`)
        }
      }
      stats.replaced++
    } catch (err) {
      stats.failed++
      console.warn(`  ! ${t.path}: ${(err as Error).message}`)
    }

    done++
    if (done % 25 === 0) {
      console.log(`  …${done}/${work.length}  replaced=${stats.replaced} skipped=${stats.skipped}`)
    }
  }

  // Small worker pool. Nearly all of the wall-clock here is network -- downloading the
  // current object, occasionally pulling a legacy original, and uploading four objects per
  // replacement -- so overlapping a handful of items is the difference between minutes and
  // hours. Kept low so the legacy PHP host is not hammered.
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < work.length) {
      const t = work[cursor++]
      await processOne(t)
    }
  })
  await Promise.all(workers)

  const under = (arr: number[], px: number) => arr.filter((a) => a < px).length
  console.log(
    `\n${JSON.stringify(
      {
        committed: COMMIT,
        ...stats,
        objects_under_600px_before: under(before, 600 * 600),
        objects_under_600px_after: under(after, 600 * 600),
        log: LOG,
      },
      null,
      1,
    )}`,
  )
}

await main()
