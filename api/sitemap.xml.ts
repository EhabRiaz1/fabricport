/**
 * /sitemap.xml — Vercel Edge Function (rewritten from /sitemap.xml in vercel.json).
 *
 * Lists the static public pages, every published public fabric and every verified mill.
 * Reads Supabase with the public anon key, so RLS decides what is listed: the same rows
 * a logged-out visitor can see in the marketplace.
 *
 * Env (Vercel project settings, all environments): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
 */
export const config = { runtime: 'edge' }

const SITE_URL = 'https://www.fabricport.com'

const STATIC_PATHS: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/marketplace', priority: '0.9', changefreq: 'daily' },
  { path: '/vendors', priority: '0.7', changefreq: 'weekly' },
  { path: '/sell', priority: '0.5', changefreq: 'monthly' },
  { path: '/terms', priority: '0.2', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.2', changefreq: 'yearly' },
]

interface ProductRow {
  slug: string
  updated_at: string | null
  published_at: string | null
}
interface SupplierRow {
  slug: string
  created_at: string | null
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function isoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

async function fetchRows<T>(base: string, key: string, query: string): Promise<T[]> {
  const res = await fetch(`${base}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
  })
  if (!res.ok) return []
  return (await res.json()) as T[]
}

export default async function handler(): Promise<Response> {
  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  const entries: string[] = []
  const push = (path: string, lastmod?: string, changefreq?: string, priority?: string) => {
    entries.push(
      '<url>' +
        `<loc>${escapeXml(SITE_URL + path)}</loc>` +
        (lastmod ? `<lastmod>${lastmod}</lastmod>` : '') +
        (changefreq ? `<changefreq>${changefreq}</changefreq>` : '') +
        (priority ? `<priority>${priority}</priority>` : '') +
        '</url>',
    )
  }

  for (const s of STATIC_PATHS) push(s.path, undefined, s.changefreq, s.priority)

  if (base && key) {
    const [products, suppliers] = await Promise.all([
      fetchRows<ProductRow>(
        base,
        key,
        'products?select=slug,updated_at,published_at&status=eq.published&visibility=eq.public&order=published_at.desc&limit=5000',
      ),
      fetchRows<SupplierRow>(
        base,
        key,
        'suppliers?select=slug,created_at&is_verified=eq.true&order=brand_name.asc&limit=1000',
      ),
    ])
    for (const p of products) {
      if (p.slug) push(`/fabric/${p.slug}`, isoDate(p.updated_at ?? p.published_at), 'weekly', '0.8')
    }
    for (const s of suppliers) {
      if (s.slug) push(`/supplier/${s.slug}`, isoDate(s.created_at), 'weekly', '0.6')
    }
  }

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    entries.join('') +
    '</urlset>'

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
