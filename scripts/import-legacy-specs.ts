/**
 * Backfills fabric specifications from the legacy control panel.
 *
 * Only the 205 products from the original May seed ever got specs; the 283 brought in by the
 * July legacy import arrived with an empty attribute set, so most fabrics on the site show
 * "GSM -", "WIDTH -", "COMPOSITION -".
 *
 * Source is mscp/catalog/view-product.php, not the public site. The public product pages
 * only render a "Fabric Specification" block for the products that were already seeded --
 * for the rest the URL in the sitemap redirects to the home page, so scraping there would
 * have silently reported "no specs upstream" for exactly the products that need them.
 *
 * Curated data is never overwritten. This only ever fills a gap:
 *   - a `product_attributes` row is inserted only when that (product, attribute) pair has
 *     none, so a value edited in the admin panel stays put;
 *   - `products.gsm`, `width_inches` and `composition` are written only where they are NULL.
 * Re-running is therefore a no-op, and a partial run is safe to resume.
 *
 * Usage:
 *   LEGACY_SESSION=<PHPSESSID> npx tsx scripts/import-legacy-specs.ts            # dry run
 *   LEGACY_SESSION=<PHPSESSID> npx tsx scripts/import-legacy-specs.ts --commit
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ws from 'ws'

config({ path: '.env.local' })

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) throw new Error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

const argv = process.argv.slice(2)
const COMMIT = argv.includes('--commit')
const LIMIT = Number(argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0)
const ONLY_SLUG = argv.find((a) => a.startsWith('--slug='))?.split('=')[1]
const CONCURRENCY = Math.max(1, Number(argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] ?? 5))
const SESSION = process.env.LEGACY_SESSION
if (!SESSION) throw new Error('Missing LEGACY_SESSION (PHPSESSID from an authenticated mscp session)')
const MSCP = 'https://www.fabricport.com/mscp'

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const execFileAsync = promisify(execFile)

/** curl, not fetch: node's fetch cannot reach fabricport.com from this environment. */
async function get(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { stdout } = await execFileAsync(
        'curl',
        [
          '-sfL', '--max-time', '60',
          '-A', 'FabricPortSpecImport/1.0 (+owner migration)',
          '-H', `Cookie: PHPSESSID=${SESSION}`,
          '-H', `Referer: ${MSCP}/catalog/products.php`,
          url,
        ],
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

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

/**
 * Reads the attribute rows out of the control panel's product form.
 *
 * Two shapes on that page:
 *   - free-text rows -- a checked `cbAttributes[]` box, a <label> holding the title, and a
 *     `txtDescription<id>` input holding the value. This is where GSM, width, construction
 *     and elongation live.
 *   - dropdown rows  -- a `cbNoneKeyAttributes[]` box whose <label> is followed by a <select>
 *     carrying the chosen option. This is where weave, finishes and type live.
 */
function parseAdminSpecs(html: string): Record<string, string> {
  const specs: Record<string, string> = {}

  const textRow =
    /<input[^>]*name="cbAttributes\[\]"[^>]*id="cbAttribute(\d+)"[^>]*\/>\s*<\/td>\s*<td><label[^>]*>([^<]*)<\/label><\/td>\s*<td><input[^>]*id="txtDescription\1"[^>]*value="([^"]*)"/g
  for (const m of html.matchAll(textRow)) {
    const label = decode(m[2]).trim()
    const value = decode(m[3]).trim()
    if (label && value) specs[label] = value
  }

  const selectRow = /<label for="cbNoneKeyAttributes[A-Za-z0-9]+">([^<]*)<\/label>/g
  for (const m of html.matchAll(selectRow)) {
    const label = decode(m[1]).trim()
    // The matching <select> is the next one in document order.
    const after = html.slice(m.index! + m[0].length, m.index! + m[0].length + 4000)
    const select = after.match(/<select[\s\S]*?<\/select>/)
    if (!select) continue
    const chosen = [...select[0].matchAll(/<option[^>]*selected[^>]*>([^<]*)<\/option>/g)]
      .map((o) => decode(o[1]).trim())
      .filter((v) => v && v.toLowerCase() !== 'content')
    if (label && chosen.length) specs[label] = chosen.join(', ')
  }

  return specs
}

/**
 * Reads the composition multi-select.
 *
 * Stored as paired inputs -- `txtCompositionLabel<id>` holding "Bamboo (Composition %)" and
 * `txtCompositionValue<id>` holding "95" -- so the fibre name has to be peeled out of the
 * label. Rendered as "Bamboo 95%, Spandex 5%", the shape the seeded products already use.
 */
function parseComposition(html: string): string | null {
  const labels = new Map<string, string>()
  for (const m of html.matchAll(/name="txtCompositionLabel(\d+)"[^>]*value="([^"]*)"/g)) {
    labels.set(m[1], decode(m[2]).replace(/\s*\(Composition\s*%\)\s*/i, '').trim())
  }

  const parts: string[] = []
  for (const m of html.matchAll(/name="txtCompositionValue(\d+)"[^>]*value="([^"]*)"/g)) {
    const fibre = labels.get(m[1])
    const pct = decode(m[2]).trim().replace(/%+$/, '')
    if (fibre && pct) parts.push(`${fibre} ${pct}%`)
  }
  return parts.length ? parts.join(', ') : null
}

/** "364 GSM | 10.75 Oz" -> 364. Also copes with a bare "220" or "220 gsm". */
function parseGsm(value: string): number | null {
  const gsm = value.match(/(\d+(?:\.\d+)?)\s*GSM/i)
  if (gsm) return Number(gsm[1])
  const bare = value.match(/^(\d+(?:\.\d+)?)$/)
  return bare ? Number(bare[1]) : null
}

function parseNumber(value: string): number | null {
  const m = value.match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : null
}

/**
 * legacy_id -> "Stock" / "Made to Order" / "Greige Stock".
 *
 * Fabric Type is a column on the control panel's product LIST, present for every product,
 * but on the product FORM it is a dropdown that reads empty for most of them. Reading it
 * from the list is the difference between the facet covering 205 products and all of them.
 */
async function fetchTypeByLegacyId(): Promise<Map<number, string>> {
  const body = await get(
    `${MSCP}/ajax/catalog/get-products.php?sEcho=1&iDisplayStart=0&iDisplayLength=2000` +
      `&iColumns=10&iSortCol_0=0&sSortDir_0=asc&iSortingCols=1&sSearch=&Type=&Category=&Supplier=&Status=`,
  )
  const map = new Map<number, string>()
  if (!body) return map
  try {
    const json = JSON.parse(body) as { aaData: unknown[][] }
    for (const row of json.aaData ?? []) {
      const id = Number(String(row[1]).match(/ProductId=(\d+)/)?.[1])
      const type = String(row[2] ?? '').trim()
      if (id && type) map.set(id, type)
    }
  } catch {
    // A non-JSON body means the session lapsed; the caller just gets an empty map.
  }
  return map
}

async function main() {
  const typeByLegacyId = await fetchTypeByLegacyId()
  console.log(`fabric types from the product list: ${typeByLegacyId.size}`)

  const { data: attributes, error: attrErr } = await db
    .from('fabric_attributes')
    .select('id, name, slug, type')
  if (attrErr) throw new Error(attrErr.message)
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim()
  const attrBySlug = new Map((attributes ?? []).map((a) => [a.slug, a]))

  /**
   * Control-panel label -> our attribute slug.
   *
   * Most titles match, but the panel splits weight into separate GSM and Oz fields and calls
   * width either "Width (Inches)" or "Full Width (Inches)" depending on the product type.
   * Anything not in here is reported at the end rather than silently dropped.
   */
  const LABEL_TO_SLUG: Record<string, string> = {
    'construction': 'construction',
    'width (inches)': 'width-inches',
    'full width (inches)': 'width-inches',
    'cuttable width (inches)': 'width-inches',
    'elongation': 'elongation',
    'growth (before wash)': 'growth-before-wash',
    'new production leadtime (days)': 'new-production-leadtime-days',
    'recommended use': 'recommended-use',
    'chemical finish': 'chemical-finish',
    'mechanical finish': 'mechanical-finish',
    'weave': 'weave',
    'knit type': 'knit-type',
    'type': 'type',
    'fabric content': 'fabric-content',
    'solid dyed / pfgd/ pattern / print': 'solid-pattern-print',
    'solid / pattern / print': 'solid-pattern-print',
  }

  let query = db
    .from('products')
    .select('id, slug, legacy_id, gsm, width_inches, composition')
    .not('legacy_id', 'is', null)
  if (ONLY_SLUG) query = query.eq('slug', ONLY_SLUG)
  const { data: products, error } = await query
  if (error) throw new Error(error.message)

  const work = LIMIT > 0 ? (products ?? []).slice(0, LIMIT) : (products ?? [])
  console.log(`products: ${work.length}`)
  console.log(COMMIT ? 'COMMIT — writing\n' : 'DRY RUN — pass --commit to write\n')

  const stats = { pagesFound: 0, noPage: 0, noSpecs: 0, attrsInserted: 0, columnsFilled: 0, failed: 0 }
  const unmapped = new Map<string, number>()
  let done = 0
  let cursor = 0

  const processOne = async (product: (typeof work)[number]) => {
    try {
      const html = await get(`${MSCP}/catalog/view-product.php?ProductId=${product.legacy_id}`)
      if (!html) {
        stats.noPage++
        return
      }
      stats.pagesFound++

      const specs = parseAdminSpecs(html)
      if (Object.keys(specs).length === 0) {
        stats.noSpecs++
        return
      }

      // --- EAV attributes -------------------------------------------------------------
      const { data: existingRows } = await db
        .from('product_attributes')
        .select('attribute_id')
        .eq('product_id', product.id)
      const already = new Set((existingRows ?? []).map((r) => r.attribute_id))

      const inserts: {
        product_id: string
        attribute_id: string
        value_text: string | null
        value_number: number | null
      }[] = []

      const push = (slug: string, value: string) => {
        const attr = attrBySlug.get(slug)
        if (!attr || already.has(attr.id)) return
        already.add(attr.id) // two legacy labels can map to one slug (width, weight)
        const numeric = attr.type === 'number' ? parseNumber(value) : null
        inserts.push({
          product_id: product.id,
          attribute_id: attr.id,
          value_text: attr.type === 'number' ? null : value,
          value_number: numeric,
        })
      }

      // Weight is two fields upstream; the seeded products store it as "364 GSM | 10.75 Oz",
      // so rebuild that exact shape rather than inventing a second format.
      // Some control-panel weight fields already carry their unit ("301 GSM" rather than
      // "301"), so strip it before re-adding one -- otherwise the value reads "301 GSM GSM".
      const bare = (v: string | undefined, unit: RegExp) =>
        v ? v.replace(unit, '').trim() : undefined
      const gsmRaw = bare(specs['Weight (Before Wash) (GSM)'], /\s*GSM\s*/gi)
      const ozRaw = bare(specs['Weight (Before Wash) (Oz)'], /\s*Oz\s*/gi)
      if (gsmRaw) {
        push('weight-before-wash', ozRaw ? `${gsmRaw} GSM | ${ozRaw} Oz` : `${gsmRaw} GSM`)
      }

      const listType = product.legacy_id != null ? typeByLegacyId.get(product.legacy_id) : undefined
      if (listType) push('type', listType)

      for (const [label, value] of Object.entries(specs)) {
        const key = norm(label)
        if (key.startsWith('weight (before wash)')) continue
        const slug = LABEL_TO_SLUG[key]
        if (!slug) {
          unmapped.set(label, (unmapped.get(label) ?? 0) + 1)
          continue
        }
        push(slug, value)
      }

      // --- promoted columns -----------------------------------------------------------
      const patch: Record<string, unknown> = {}
      if (product.gsm == null && gsmRaw) {
        const gsm = parseGsm(gsmRaw)
        if (gsm) patch.gsm = gsm
      }
      const widthRaw =
        specs['Width (Inches)'] ?? specs['Full Width (Inches)'] ?? specs['Cuttable Width (Inches)']
      if (product.width_inches == null && widthRaw) {
        const inches = parseNumber(widthRaw)
        if (inches) patch.width_inches = inches
      }
      if (!product.composition) {
        const composition = parseComposition(html)
        if (composition) patch.composition = composition
      }

      console.log(
        `  ${product.slug}: ${inserts.length} attribute(s), ${Object.keys(patch).length} column(s)`,
      )

      if (COMMIT) {
        if (inserts.length > 0) {
          const { error: insErr } = await db.from('product_attributes').insert(inserts)
          if (insErr) throw new Error(`attributes: ${insErr.message}`)
        }
        if (Object.keys(patch).length > 0) {
          const { error: updErr } = await db.from('products').update(patch).eq('id', product.id)
          if (updErr) throw new Error(`columns: ${updErr.message}`)
        }
      }
      stats.attrsInserted += inserts.length
      stats.columnsFilled += Object.keys(patch).length
    } catch (err) {
      stats.failed++
      console.warn(`  ! ${product.slug}: ${(err as Error).message}`)
    }
    done++
    if (done % 50 === 0) console.log(`  …${done}/${work.length}`)
  }

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < work.length) await processOne(work[cursor++])
  })
  await Promise.all(workers)

  console.log(`\n${JSON.stringify({ committed: COMMIT, ...stats }, null, 1)}`)
  if (unmapped.size > 0) {
    // Reported, never dropped in silence -- a new attribute upstream should be visible.
    console.log('\nlegacy labels with no matching attribute:')
    for (const [label, count] of [...unmapped].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count.toString().padStart(4)}  ${label}`)
    }
  }
}

await main()
