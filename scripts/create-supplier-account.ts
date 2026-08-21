/**
 * Creates a supplier account that exists on the legacy site but was never onboarded here.
 *
 * The legacy control panel lists Crescent Bahuman with 8 Active fabrics; the July migration
 * only created accounts from the supplier credential list, so they have no way to sign in and
 * their catalogue is absent from the platform entirely.
 *
 * Writes the generated password to a file rather than printing it, so it does not end up in
 * a scrollback buffer or a CI log. That file is gitignored.
 *
 * Idempotent: an existing auth user is adopted rather than recreated, and its password is
 * never reset -- re-running against an already-created account reports no credentials rather
 * than quietly locking the supplier out of one they already have.
 *
 * Usage:
 *   npx tsx scripts/create-supplier-account.ts --brand="Crescent Bahuman" --email=… --out=File.txt
 *   ... --commit
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import ws from 'ws'

config({ path: '.env.local' })

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) throw new Error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

const argv = process.argv.slice(2)
const COMMIT = argv.includes('--commit')
const val = (f: string) => argv.find((a) => a.startsWith(`${f}=`))?.split('=').slice(1).join('=')

const BRAND = val('--brand')
const EMAIL = val('--email')
const OUT = val('--out')
const CONTACT = val('--contact') ?? BRAND
if (!BRAND || !EMAIL || !OUT) throw new Error('Pass --brand=… --email=… --out=…')

const db = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

/** Same shape as the migration's passwords: readable, from an unambiguous alphabet. */
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

async function findByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  const slug = slugify(BRAND!)
  console.log(`brand: ${BRAND}\nemail: ${EMAIL}\nslug:  ${slug}`)
  console.log(COMMIT ? 'COMMIT — writing\n' : 'DRY RUN — pass --commit to write\n')

  const existingUser = await findByEmail(EMAIL!)
  if (existingUser) console.log(`  auth user already exists (${existingUser.id})`)

  const { data: clash } = await db
    .from('suppliers')
    .select('id, brand_name')
    .eq('slug', slug)
    .maybeSingle()
  if (clash) throw new Error(`supplier slug "${slug}" is taken by ${clash.id} (${clash.brand_name})`)

  if (!COMMIT) {
    console.log('  would create: auth user, profile (role=supplier, status=active), suppliers row')
    return
  }

  let userId: string
  let password: string | null = null

  if (existingUser) {
    userId = existingUser.id
  } else {
    password = makePassword()
    const { data, error } = await db.auth.admin.createUser({
      email: EMAIL!,
      password,
      // No invite mail: credentials are handed over by hand, same as the migration.
      email_confirm: true,
      user_metadata: { role: 'supplier', full_name: CONTACT },
    })
    if (error) throw new Error(`${EMAIL}: ${error.message}`)
    userId = data.user.id
  }

  const { error: profErr } = await db
    .from('profiles')
    .update({ role: 'supplier', status: 'active', full_name: CONTACT, company_name: BRAND })
    .eq('id', userId)
  if (profErr) throw new Error(`profile: ${profErr.message}`)

  const { data: supplier } = await db.from('suppliers').select('id').eq('id', userId).maybeSingle()
  if (!supplier) {
    const { error: supErr } = await db.from('suppliers').insert({
      id: userId,
      brand_name: BRAND,
      slug,
      is_verified: true,
      badge_label: 'Verified',
    })
    if (supErr) throw new Error(`supplier: ${supErr.message}`)
  }

  if (password) {
    writeFileSync(
      OUT!,
      [
        `FABRICPORT — SUPPLIER ACCOUNT`,
        ``,
        `Company:   ${BRAND}`,
        `Email:     ${EMAIL}`,
        `Password:  ${password}`,
        `Portal:    /supplier-portal/dashboard`,
        ``,
        `Created ${new Date().toISOString()} by scripts/create-supplier-account.ts.`,
        `This password was generated here and is not recoverable from the database.`,
        `Hand it over directly and ask them to change it after first sign-in.`,
        `Gitignored — delete this file once the credentials have been passed on.`,
        ``,
      ].join('\n'),
      'utf8',
    )
    console.log(`  credentials written to ${OUT}`)
  } else {
    console.log('  account already existed; password left untouched and no file written')
  }

  console.log(`\n${JSON.stringify({ userId, slug, created: !existingUser }, null, 1)}`)
}

await main()
