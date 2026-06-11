/**
 * FabricPort catalogue seed script.
 *
 * Usage: npm run seed
 * Requires: .env.local with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import ws from 'ws'
import {
  generateImageVariants,
  getVariantStoragePaths,
} from './lib/image-variants.ts'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PRODUCTS_JSON = '/Users/ehabriaz/Desktop/Fabricport/data/products.json'
const IMAGES_DIR = '/Users/ehabriaz/Desktop/Fabricport/public/images/products'
const FX_RATE = 278.5
const BUCKET = 'product-images'
const FEATURED_COUNT = 4

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: fetch.bind(globalThis) },
  realtime: { transport: ws as unknown as typeof WebSocket },
})

interface JsonSupplier {
  name: string
  slug: string
}

interface JsonProduct {
  id: string
  slug: string
  category: string
  name: string
  description: string | null
  supplier: JsonSupplier
  pricing: { currency: string; amount: number; unit: string }
  stock: { quantityLabel: string; unit: string }
  specifications: Record<string, string>
  images: { originals: string[]; thumbnails: string[] }
}

interface ProductsFile {
  count: number
  products: JsonProduct[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseStockMeters(label?: string | null): number {
  if (!label) return 0
  const match = label.replace(/,/g, '').match(/([\d.]+)/)
  return match ? Number(match[1]) : 0
}

function parseNumericValue(value: string): number | null {
  const match = value.replace(/,/g, '').match(/([\d.]+)/)
  if (!match) return null
  const num = Number(match[1])
  return Number.isFinite(num) ? num : null
}

function inferAttributeType(key: string): Database['public']['Tables']['fabric_attributes']['Insert']['type'] {
  if (key.includes('Width') || key === 'Elongation' || key.includes('Leadtime')) {
    return 'number'
  }
  if (key === 'Type' || key === 'Solid / Pattern / Print' || key === 'Knit Type' || key === 'Weave') {
    return 'select'
  }
  return 'text'
}

function log(step: string, detail?: string) {
  console.log(detail ? `[seed] ${step}: ${detail}` : `[seed] ${step}`)
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === BUCKET)
  if (exists) {
    log('bucket', `${BUCKET} already exists`)
    return
  }

  const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
  if (error) throw new Error(`Failed to create bucket ${BUCKET}: ${error.message}`)
  log('bucket', `created ${BUCKET}`)
}

async function seedFabricAttributes(products: JsonProduct[]) {
  const specKeys = new Set<string>()
  for (const product of products) {
    for (const key of Object.keys(product.specifications ?? {})) {
      specKeys.add(key)
    }
  }

  const sortedKeys = [...specKeys].sort()
  const attributeMap = new Map<string, string>()

  for (let i = 0; i < sortedKeys.length; i++) {
    const name = sortedKeys[i]
    const slug = slugify(name)

    const { data: existing } = await supabase
      .from('fabric_attributes')
      .select('id, slug')
      .eq('slug', slug)
      .is('category_id', null)
      .maybeSingle()

    if (existing) {
      attributeMap.set(name, existing.id)
      continue
    }

    const { data, error } = await supabase
      .from('fabric_attributes')
      .insert({
        name,
        slug,
        type: inferAttributeType(name),
        category_id: null,
        is_filterable: true,
        is_required: false,
        display_order: i + 1,
        unit: name.includes('Inches') ? 'in' : name.includes('Days') ? 'days' : null,
      })
      .select('id')
      .single()

    if (error) throw new Error(`fabric_attributes insert failed for ${slug}: ${error.message}`)
    attributeMap.set(name, data.id)
  }

  log('fabric_attributes', `${attributeMap.size} attributes ready`)
  return attributeMap
}

async function findAuthUserByEmail(email: string) {
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((user) => user.email === email)
    if (match) return match
    if (data.users.length < 200) break
    page += 1
  }
  return null
}

async function ensureSupplierUser(slug: string, brandName: string): Promise<string> {
  const email = `seed+${slug}@fabricport.internal`

  const existingAuth = await findAuthUserByEmail(email)
  if (existingAuth) {
    return existingAuth.id
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: `Seed-${slug}-${randomUUID().slice(0, 8)}!`,
    email_confirm: true,
    user_metadata: {
      role: 'supplier',
      full_name: brandName,
      company_name: brandName,
    },
  })

  if (authError) {
    throw new Error(`auth.admin.createUser failed for ${slug}: ${authError.message}`)
  }

  return authUser.user.id
}

async function seedSuppliers(
  suppliers: Map<string, string>,
): Promise<Map<string, string>> {
  const supplierIds = new Map<string, string>()

  for (const [slug, brandName] of suppliers) {
    const { data: existingSupplier } = await supabase
      .from('suppliers')
      .select('id, slug')
      .eq('slug', slug)
      .maybeSingle()

    if (existingSupplier) {
      supplierIds.set(slug, existingSupplier.id)
      log('supplier', `reusing ${slug}`)
      continue
    }

    const userId = await ensureSupplierUser(slug, brandName)

    await supabase
      .from('profiles')
      .update({
        role: 'supplier',
        full_name: brandName,
        company_name: brandName,
        status: 'active',
      })
      .eq('id', userId)

    const { error: supplierError } = await supabase.from('suppliers').upsert(
      {
        id: userId,
        brand_name: brandName,
        slug,
        is_verified: true,
        badge_label: 'Verified',
      },
      { onConflict: 'id' },
    )

    if (supplierError) {
      throw new Error(`suppliers insert failed for ${slug}: ${supplierError.message}`)
    }

    supplierIds.set(slug, userId)
    log('supplier', `created ${slug} (${userId})`)
  }

  return supplierIds
}

async function seedFxRate() {
  const { error } = await supabase.from('fx_rates').upsert(
    { base: 'USD', target: 'PKR', rate: FX_RATE, fetched_at: new Date().toISOString() },
    { onConflict: 'base,target' },
  )

  if (error) throw new Error(`fx_rates upsert failed: ${error.message}`)
  log('fx_rates', `USD → PKR = ${FX_RATE}`)
}

async function uploadProductImages(
  productSlug: string,
  filenames: string[],
): Promise<string[]> {
  const uploadedPaths: string[] = []
  const uniqueFiles = [...new Set(filenames.filter(Boolean))]

  for (const filename of uniqueFiles) {
    const localPath = join(IMAGES_DIR, filename)
    if (!existsSync(localPath)) {
      log('image missing', filename)
      continue
    }

    const storagePath = `${productSlug}/${basename(filename)}`
    const fileBuffer = readFileSync(localPath)
    const contentType = filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    })

    if (error) {
      log('image upload error', `${filename}: ${error.message}`)
      continue
    }

    uploadedPaths.push(storagePath)

    try {
      const variants = await generateImageVariants(fileBuffer)
      const variantPaths = getVariantStoragePaths(storagePath)

      for (const variant of ['card', 'medium'] as const) {
        const { error: variantError } = await supabase.storage.from(BUCKET).upload(
          variantPaths[variant],
          variants[variant],
          {
            contentType: 'image/webp',
            upsert: true,
          },
        )

        if (variantError) {
          log('variant upload error', `${variantPaths[variant]}: ${variantError.message}`)
        }
      }
    } catch (variantErr) {
      log(
        'variant generation error',
        `${storagePath}: ${variantErr instanceof Error ? variantErr.message : 'unknown error'}`,
      )
    }
  }

  return uploadedPaths
}

async function seedProducts(
  products: JsonProduct[],
  supplierIds: Map<string, string>,
  categoryIds: Map<string, string>,
  attributeMap: Map<string, string>,
) {
  let created = 0
  let skipped = 0

  for (let index = 0; index < products.length; index++) {
    const item = products[index]
    const supplierId = supplierIds.get(item.supplier.slug)
    const categoryId = categoryIds.get(item.category)

    if (!supplierId) {
      throw new Error(`Missing supplier for product ${item.slug}: ${item.supplier.slug}`)
    }

    const { data: existing } = await supabase
      .from('products')
      .select('id, images')
      .eq('slug', item.slug)
      .maybeSingle()

    const imagePaths = await uploadProductImages(item.slug, item.images?.originals ?? [])

    if (existing) {
      const existingImages = existing.images as string[] | null
      if (imagePaths.length > 0 && (!existingImages || existingImages.length === 0)) {
        const { error: imageUpdateError } = await supabase
          .from('products')
          .update({ images: imagePaths })
          .eq('id', existing.id)

        if (imageUpdateError) {
          throw new Error(`product image update failed for ${item.slug}: ${imageUpdateError.message}`)
        }
        log('images', `updated ${item.slug}`)
      }
      skipped++
      continue
    }

    const pricePkr = item.pricing.amount
    const priceUsd = Number((pricePkr / FX_RATE).toFixed(2))
    const stockMeters = parseStockMeters(item.stock?.quantityLabel)
    const isFeatured = index < FEATURED_COUNT

    const { data: product, error: productError } = await supabase
      .from('products')
      .insert({
        supplier_id: supplierId,
        category_id: categoryId ?? null,
        title: item.name,
        slug: item.slug,
        description: item.description,
        status: 'published',
        visibility: 'public',
        price_min_pkr: pricePkr,
        price_max_pkr: pricePkr,
        price_min_usd: priceUsd,
        price_max_usd: priceUsd,
        price_approved: true,
        stock_meters: stockMeters,
        images: imagePaths,
        is_featured: isFeatured,
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (productError) {
      throw new Error(`product insert failed for ${item.slug}: ${productError.message}`)
    }

    const attributeRows = Object.entries(item.specifications ?? {})
      .map(([key, value]) => {
        const attributeId = attributeMap.get(key)
        if (!attributeId) return null

        const numeric = parseNumericValue(value)
        const row: Database['public']['Tables']['product_attributes']['Insert'] = {
          product_id: product.id,
          attribute_id: attributeId,
          value_text: value,
        }

        if (numeric !== null && inferAttributeType(key) === 'number') {
          row.value_number = numeric
        }

        return row
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)

    if (attributeRows.length > 0) {
      const { error: attrError } = await supabase.from('product_attributes').insert(attributeRows)
      if (attrError) {
        throw new Error(`product_attributes insert failed for ${item.slug}: ${attrError.message}`)
      }
    }

    created++
    if (created % 25 === 0) {
      log('products', `${created}/${products.length} inserted`)
    }
  }

  log('products', `done — ${created} created, ${skipped} skipped (already exist)`)
}

async function loadCategoryIds(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('fabric_categories').select('id, slug')
  if (error) throw new Error(`fabric_categories fetch failed: ${error.message}`)

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    map.set(row.slug, row.id)
  }
  return map
}

async function main() {
  log('start', 'FabricPort catalogue seed')

  const raw = readFileSync(PRODUCTS_JSON, 'utf-8')
  const catalogue = JSON.parse(raw) as ProductsFile

  if (catalogue.products.length !== catalogue.count) {
    log('warn', `count mismatch: file says ${catalogue.count}, array has ${catalogue.products.length}`)
  }

  const supplierMap = new Map<string, string>()
  for (const product of catalogue.products) {
    supplierMap.set(product.supplier.slug, product.supplier.name)
  }

  if (supplierMap.size !== 8) {
    log('warn', `expected 8 suppliers, found ${supplierMap.size}`)
  }

  await ensureBucket()

  const categoryIds = await loadCategoryIds()
  const attributeMap = await seedFabricAttributes(catalogue.products)
  const supplierIds = await seedSuppliers(supplierMap)
  await seedFxRate()
  await seedProducts(catalogue.products, supplierIds, categoryIds, attributeMap)

  const { count: featuredCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('is_featured', true)

  log('complete', `${catalogue.products.length} products, ${supplierMap.size} suppliers, ${featuredCount ?? FEATURED_COUNT} featured`)
}

main().catch((err) => {
  console.error('[seed] fatal:', err)
  process.exit(1)
})
