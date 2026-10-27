/**
 * Vercel Edge Middleware: share previews and crawler titles for fabric and supplier pages.
 *
 * The app is a client-rendered SPA, so WhatsApp, Facebook, LinkedIn, Slack and search bots
 * would otherwise see the one static title and image from index.html on every URL. For
 * requests to /fabric/:slug and /supplier/:slug from a known preview/crawler user agent,
 * this fetches the row from Supabase (anon key, so RLS applies) and returns index.html
 * with the <title>, description and og:* tags replaced. Everyone else gets the normal SPA.
 *
 * Env (Vercel project settings, all environments): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
 */
export const config = {
  matcher: ['/fabric/:slug*', '/supplier/:slug*'],
}

const SITE_URL = 'https://www.fabricport.com'
const SITE_NAME = 'FabricPort'
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`

const CRAWLER_RE =
  /facebookexternalhit|facebot|whatsapp|twitterbot|linkedinbot|slackbot|slack-imgproxy|discordbot|telegrambot|googlebot|bingbot|duckduckbot|yandex|baiduspider|applebot|pinterest|embedly|quora link preview|skypeuripreview|vkshare|redditbot|iframely|outbrain|w3c_validator|petalbot/i

interface ProductRow {
  title: string
  description: string | null
  composition: string | null
  gsm: number | null
  width_inches: number | null
  images: string[] | null
  price_min_pkr: number | null
  price_approved: boolean | null
  supplier: { brand_name: string } | null
  category: { name: string } | null
}

interface SupplierRow {
  brand_name: string
  badge_label: string | null
  is_verified: boolean
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function imageUrl(base: string, path: string | undefined): string {
  if (!path) return DEFAULT_IMAGE
  if (path.startsWith('http')) return path
  // Same derivative naming as src/lib/product-images.ts (medium = 960px WebP).
  const derived = /\.thumb\.(card|medium|large)\.webp$/i.test(path)
    ? path
    : `${path.replace(/\.[^.]+$/, '')}.thumb.medium.webp`
  return `${base}/storage/v1/object/public/product-images/${derived}`
}

async function fetchOne<T>(base: string, key: string, query: string): Promise<T | null> {
  try {
    const res = await fetch(`${base}/rest/v1/${query}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/vnd.pgrst.object+json',
      },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function replaceTag(html: string, pattern: RegExp, replacement: string): string {
  return pattern.test(html) ? html.replace(pattern, replacement) : html
}

function injectMeta(
  html: string,
  meta: { title: string; description: string; image: string; url: string; type: string },
): string {
  const title = escapeHtml(meta.title)
  const desc = escapeHtml(meta.description)
  const image = escapeHtml(meta.image)
  const url = escapeHtml(meta.url)
  let out = html
  out = replaceTag(out, /<title>[^<]*<\/title>/i, `<title>${title}</title>`)
  out = replaceTag(out, /<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${desc}" />`)
  out = replaceTag(out, /<meta property="og:type" content="[^"]*"\s*\/?>/i, `<meta property="og:type" content="${meta.type}" />`)
  out = replaceTag(out, /<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${title}" />`)
  out = replaceTag(out, /<meta property="og:description" content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${desc}" />`)
  out = replaceTag(out, /<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${url}" />`)
  out = replaceTag(out, /<meta property="og:image" content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${image}" />`)
  out = replaceTag(out, /<meta property="og:image:type" content="[^"]*"\s*\/?>/i, image.endsWith('.png') ? '<meta property="og:image:type" content="image/png" />' : '<meta property="og:image:type" content="image/webp" />')
  out = replaceTag(out, /<meta property="og:image:width" content="[^"]*"\s*\/?>/i, image === DEFAULT_IMAGE ? '<meta property="og:image:width" content="1200" />' : '')
  out = replaceTag(out, /<meta property="og:image:height" content="[^"]*"\s*\/?>/i, image === DEFAULT_IMAGE ? '<meta property="og:image:height" content="630" />' : '')
  out = replaceTag(out, /<meta property="og:image:alt" content="[^"]*"\s*\/?>/i, `<meta property="og:image:alt" content="${title}" />`)
  // Canonical + twitter tags are not in index.html; add them once.
  out = out.replace(
    '</head>',
    `<link rel="canonical" href="${url}" />` +
      `<meta name="twitter:title" content="${title}" />` +
      `<meta name="twitter:description" content="${desc}" />` +
      `<meta name="twitter:image" content="${image}" />` +
      '</head>',
  )
  return out
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const ua = request.headers.get('user-agent') ?? ''
  if (!CRAWLER_RE.test(ua)) return undefined

  const base = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!base || !key) return undefined

  const url = new URL(request.url)
  const match = url.pathname.match(/^\/(fabric|supplier)\/([^/]+)\/?$/)
  if (!match) return undefined
  const [, kind, rawSlug] = match
  const slug = decodeURIComponent(rawSlug)

  const shellRes = await fetch(new URL('/index.html', url.origin).toString(), {
    headers: { 'user-agent': 'fabricport-middleware' },
  })
  if (!shellRes.ok) return undefined
  const shell = await shellRes.text()

  if (kind === 'fabric') {
    const product = await fetchOne<ProductRow>(
      base,
      key,
      `products?select=title,description,composition,gsm,width_inches,images,price_min_pkr,price_approved,supplier:suppliers(brand_name),category:fabric_categories(name)&slug=eq.${encodeURIComponent(slug)}&status=eq.published&visibility=eq.public`,
    )
    if (!product) return undefined

    const specs = [
      product.gsm != null ? `${Math.round(product.gsm)} GSM` : null,
      product.width_inches != null ? `${product.width_inches}" wide` : null,
      product.composition,
      product.category?.name,
    ].filter(Boolean)
    const mill = product.supplier?.brand_name
    const descriptionParts = [
      mill ? `${product.title} by ${mill}.` : `${product.title}.`,
      specs.length ? specs.join(' · ') + '.' : null,
      product.description?.replace(/\s+/g, ' ').trim() || null,
    ].filter(Boolean)
    const description = descriptionParts.join(' ').slice(0, 300)

    return new Response(
      injectMeta(shell, {
        title: mill ? `${product.title} — ${mill} · ${SITE_NAME}` : `${product.title} · ${SITE_NAME}`,
        description,
        image: imageUrl(base, product.images?.[0]),
        url: `${SITE_URL}/fabric/${encodeURIComponent(slug)}`,
        type: 'product',
      }),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
    )
  }

  const supplier = await fetchOne<SupplierRow>(
    base,
    key,
    `suppliers?select=brand_name,badge_label,is_verified&slug=eq.${encodeURIComponent(slug)}`,
  )
  if (!supplier) return undefined

  return new Response(
    injectMeta(shell, {
      title: `${supplier.brand_name} · ${SITE_NAME}`,
      description: `${supplier.is_verified ? 'Verified mill' : 'Mill'} on FabricPort. Browse ${supplier.brand_name}'s surplus and running fabrics with measured specs, and inquire directly.`,
      image: DEFAULT_IMAGE,
      url: `${SITE_URL}/supplier/${encodeURIComponent(slug)}`,
      type: 'profile',
    }),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
  )
}
