/**
 * Backfill gsm / width_inches / composition on products from the source export.
 *
 * Usage: npx tsx scripts/backfill-specs.ts
 * Requires: .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent: matches products by slug and overwrites the three spec columns.
 * Reports any product whose specs could not be parsed rather than defaulting
 * silently.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import ws from 'ws'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PRODUCTS_JSON = '/Users/ehabriaz/Desktop/Fabricport/data/products.json'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: fetch.bind(globalThis) },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

interface JsonProduct {
  slug?: string
  specifications?: Record<string, string>
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null
  const match = value.match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : null
}

function parseGsm(value: string | undefined): number | null {
  if (!value) return null
  const match = value.match(/(\d+(?:\.\d+)?)\s*GSM/i)
  return match ? Number(match[1]) : null
}

async function main() {
  const raw = JSON.parse(readFileSync(PRODUCTS_JSON, 'utf-8')) as { products: JsonProduct[] }
  const items = raw.products ?? []

  let updated = 0
  const failures: string[] = []

  for (const item of items) {
    if (!item.slug) continue
    const specs = item.specifications ?? {}
    const gsm = parseGsm(specs['Weight (Before Wash)'])
    const width = parseNumber(specs['Width (Inches)'])
    const composition = (specs['Fabric Content'] ?? '').trim() || null

    if (gsm === null) failures.push(`${item.slug}: no GSM in "${specs['Weight (Before Wash)'] ?? ''}"`)

    const { error, count } = await supabase
      .from('products')
      .update({ gsm, width_inches: width, composition }, { count: 'exact' })
      .eq('slug', item.slug)

    if (error) {
      failures.push(`${item.slug}: update failed — ${error.message}`)
    } else {
      updated += count ?? 0
    }
  }

  console.log(`Backfill complete. Rows updated: ${updated}/${items.length}`)
  if (failures.length) {
    console.warn(`\n${failures.length} issue(s):`)
    for (const f of failures) console.warn(`  - ${f}`)
  } else {
    console.log('No parse failures.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
