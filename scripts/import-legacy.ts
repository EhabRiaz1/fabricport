/**
 * One-shot import of the legacy fabricport.com/mscp catalogue into Supabase.
 *
 * Idempotent: products upsert on `legacy_id`, people are matched on email, so a
 * re-run updates instead of duplicating. Safe to run more than once.
 *
 * Reads the JSON produced by the read-only extraction step. Requires
 * SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses RLS; auth.admin needs it).
 *
 * Usage:
 *   npx tsx scripts/import-legacy.ts accounts   # suppliers + buyers
 *   npx tsx scripts/import-legacy.ts products   # catalogue
 *   npx tsx scripts/import-legacy.ts images     # re-host product images
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import ws from 'ws'

config({ path: '.env.local' })

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATA = process.env.LEGACY_DATA_DIR
if (!URL || !KEY) throw new Error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
if (!DATA) throw new Error('Missing LEGACY_DATA_DIR (folder holding the extracted JSON)')

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

const read = <T>(f: string): T => JSON.parse(readFileSync(`${DATA}/${f}`, 'utf8')) as T

/** Readable but strong: 3 blocks of 4 from an unambiguous alphabet. */
function makePassword(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz'
  const pick = (n: number) =>
    Array.from(randomBytes(n))
      .map((b) => A[b % A.length])
      .join('')
  return `Fp-${pick(4)}-${pick(4)}-${pick(4)}`
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

interface Credential {
  role: 'supplier' | 'buyer'
  company: string
  name: string
  email: string
  password: string
  created: boolean
}

async function findByEmail(email: string) {
  // listUsers is paginated; walk until found rather than assuming page 1.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

async function ensureUser(
  email: string,
  role: 'supplier' | 'buyer',
  fullName: string,
  companyName: string,
): Promise<{ id: string; password: string | null; created: boolean }> {
  const existing = await findByEmail(email)
  if (existing) {
    // Never reset a password on an account that already exists.
    await db.from('profiles').update({ role, full_name: fullName, company_name: companyName }).eq('id', existing.id)
    return { id: existing.id, password: null, created: false }
  }

  const password = makePassword()
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no invite email is sent — credentials are handed over manually
    user_metadata: { role, full_name: fullName },
  })
  if (error) throw new Error(`${email}: ${error.message}`)

  const id = data.user.id
  await db
    .from('profiles')
    .update({ role, status: 'active', full_name: fullName, company_name: companyName })
    .eq('id', id)
  return { id, password, created: true }
}

// ------------------------------------------------------------------ accounts
async function importAccounts() {
  const suppliers = read<string[][]>('suppliers.json')
  const buyers = read<{ email: string; name: string; country: string; status: string }[]>(
    'buyers-clean.json',
  )
  const creds: Credential[] = []

  console.log(`suppliers: ${suppliers.length}, buyers (cleaned): ${buyers.length}`)

  for (const row of suppliers) {
    const [, company, name, email, , , , status] = row
    if (!email?.includes('@')) continue
    const r = await ensureUser(email.trim(), 'supplier', name || company, company)

    const { data: sup } = await db.from('suppliers').select('id').eq('id', r.id).maybeSingle()
    if (!sup) {
      const brand = company || name
      const slug = slugify(brand)

      // A slug clash means this BRAND already has a supplier row -- almost always the
      // placeholder that seed-catalogue.ts created (seed+<slug>@fabricport.internal).
      // The original version of this code disambiguated the slug and inserted a second
      // row, which is what stranded 205 products on accounts nobody could log into and
      // left 8 brands with two public supplier pages. Adopt the existing row instead:
      // hand it to this real auth user by moving every reference, then delete it.
      //
      // suppliers.id IS the auth user id, so "adopting" means repointing all nine FKs.
      // That is what 20260821090000_merge_duplicate_suppliers.sql does, and re-running
      // it is the supported way to reconcile. Fail loudly rather than fork again.
      const { data: clash } = await db
        .from('suppliers')
        .select('id, brand_name')
        .eq('slug', slug)
        .maybeSingle()
      if (clash) {
        throw new Error(
          `supplier slug "${slug}" already belongs to ${clash.id} (${clash.brand_name}). ` +
            `Refusing to create a duplicate supplier row for ${email}. Run the ` +
            `merge_duplicate_suppliers migration, or repoint that row's id first.`,
        )
      }

      await db.from('suppliers').insert({
        id: r.id,
        brand_name: brand,
        slug,
        is_verified: status === 'Active',
      })
    }
    if (r.password) {
      creds.push({ role: 'supplier', company, name, email: email.trim(), password: r.password, created: true })
    }
    process.stdout.write(r.created ? '+' : '.')
  }
  console.log()

  // 7 emails appear in BOTH legacy lists. A profile has exactly one role, so the
  // second pass would silently demote a supplier to buyer. Supplier wins only if
  // they actually own catalogue; otherwise the supplier record is an empty shell
  // and buyer is the accurate role.
  const supplierEmails = new Map(
    suppliers
      .filter((r) => r[3]?.includes('@'))
      .map((r) => [r[3].trim().toLowerCase(), Number(r[5]) || 0]),
  )

  for (const b of buyers) {
    const owns = supplierEmails.get(b.email.trim().toLowerCase())
    if (owns && owns > 0) {
      console.log(`\n  skip buyer ${b.email} — already a supplier owning ${owns} products`)
      continue
    }
    const r = await ensureUser(b.email, 'buyer', b.name || b.email, b.name || '')
    const { data: buy } = await db.from('buyers').select('id').eq('id', r.id).maybeSingle()
    if (!buy) {
      await db.from('buyers').insert({ id: r.id, email_domain: b.email.split('@')[1]?.toLowerCase() ?? null })
    }
    if (r.password) {
      creds.push({ role: 'buyer', company: b.name, name: b.name, email: b.email, password: r.password, created: true })
    }
    process.stdout.write(r.created ? '+' : '.')
  }
  console.log()

  writeFileSync(`${DATA}/credentials.json`, JSON.stringify(creds, null, 1))
  console.log(`new accounts created: ${creds.length} (existing accounts were left untouched)`)
}

// ------------------------------------------------------------------ products
interface LegacyProduct {
  legacy_id: number
  name: string
  slug: string
  code: string | null
  price_pkr: string | null
  stock: string | null
  three_d_url: string | null
  category: string | null
  supplier: string | null
  unit: string | null
  status: string | null
  colors: string[]
  composition: { fiber: string; pct: string | null }[]
  images: string[]
}

async function importProducts() {
  const products = read<LegacyProduct[]>('legacy-products.json')

  const { data: sups } = await db.from('suppliers').select('id, brand_name')

  // Build the brand -> id map defensively. This used to be a bare `new Map(...)`, which
  // silently resolved duplicate brand_names last-write-wins over an unordered SELECT --
  // so which of two identically-named supplier rows owned a product was luck. The DB now
  // has a unique index on lower(btrim(brand_name)), but a retired row ("[retired] Foo")
  // or a future import could still surprise us, so assert instead of guessing.
  const byName = new Map<string, string>()
  for (const s of sups ?? []) {
    if (s.brand_name.startsWith('[retired] ')) continue
    const key = s.brand_name.toLowerCase().trim()
    const existing = byName.get(key)
    if (existing && existing !== s.id) {
      throw new Error(
        `two supplier rows share the brand name "${s.brand_name}" (${existing}, ${s.id}). ` +
          `Merge them before importing products -- see merge_duplicate_suppliers.`,
      )
    }
    byName.set(key, s.id)
  }

  const { data: cats } = await db.from('fabric_categories').select('id, name')
  const catByName = new Map((cats ?? []).map((c) => [c.name.toLowerCase().trim(), c.id]))

  let updated = 0, inserted = 0, skipped = 0, reassigned = 0
  const unmatched: string[] = []

  for (const p of products) {
    const supplierId = p.supplier ? byName.get(p.supplier.toLowerCase().trim()) : undefined
    if (!supplierId) {
      // supplier_id is NOT NULL — a product with no resolvable supplier cannot be
      // inserted. Log it rather than inventing an owner.
      skipped++
      unmatched.push(`${p.slug} (supplier: ${p.supplier ?? 'none'})`)
      continue
    }

    const composition = p.composition.length
      ? p.composition.map((c) => `${c.fiber}${c.pct ? ` ${c.pct}` : ''}`).join(', ')
      : null

    const payload = {
      supplier_id: supplierId,
      title: p.name,
      slug: p.slug,
      legacy_id: p.legacy_id,
      status: p.status === 'Active' ? 'published' : 'draft',
      stock_meters: Number(p.stock) || 0,
      price_min_pkr: Number(p.price_pkr) || null,
      category_id: p.category ? catByName.get(p.category.toLowerCase().trim()) ?? null : null,
      composition,
      model_embed_url: p.three_d_url || null,
      color_display_name: p.colors[0] ?? null,
      published_at: p.status === 'Active' ? new Date().toISOString() : null,
    }

    const { data: existing } = await db
      .from('products')
      .select('id, supplier_id')
      .eq('slug', p.slug)
      .maybeSingle()

    if (existing) {
      // Existing (seeded) row: backfill legacy linkage, the 3D URL, and OWNERSHIP.
      // Do NOT clobber curated titles, prices, images or colour classification.
      //
      // supplier_id belongs in this list. Omitting it is what left 205 seeded products
      // owned by seed+<slug>@fabricport.internal after this import ran: every one of them
      // matched by slug, got a legacy_id stamped, and kept its placeholder owner. Ownership
      // is not curated data -- the legacy export is authoritative for it.
      const { error } = await db
        .from('products')
        .update({
          legacy_id: p.legacy_id,
          model_embed_url: p.three_d_url || null,
          supplier_id: supplierId,
        })
        .eq('id', existing.id)
      if (error) throw new Error(`${p.slug}: ${error.message}`)
      if (existing.supplier_id !== supplierId) reassigned++
      updated++
    } else {
      const { error } = await db.from('products').insert(payload)
      if (error) throw new Error(`${p.slug}: ${error.message}`)
      inserted++
    }
    if ((updated + inserted) % 50 === 0) process.stdout.write(`  …${updated + inserted}\n`)
  }

  writeFileSync(`${DATA}/import-skipped.json`, JSON.stringify(unmatched, null, 1))
  console.log(JSON.stringify({ updated, inserted, skipped, reassigned }, null, 1))
}

const mode = process.argv[2]
if (mode === 'accounts') await importAccounts()
else if (mode === 'products') await importProducts()
else console.log('usage: import-legacy.ts accounts|products')
