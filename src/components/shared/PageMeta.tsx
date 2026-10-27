import { useEffect } from 'react'

const SITE_NAME = 'FabricPort'
const SITE_URL = 'https://www.fabricport.com'
const DEFAULT_TITLE = 'FabricPort — Surplus Fabric Marketplace'
const DEFAULT_DESCRIPTION =
  "Pakistan's premier surplus fabric exchange. Source verified Pakistani textiles with precision specs, direct supplier chat, and 3D fabric visualization."
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`

export interface PageMetaProps {
  /** Page title without the site suffix; the suffix is appended. Omit for the home page. */
  title?: string
  description?: string
  /** Absolute image URL for link previews. */
  image?: string
  /** Path (e.g. "/fabric/kabosu") used for the canonical and og:url. Defaults to the current path. */
  path?: string
  /** Keep crawlers out of logged-in or private pages. */
  noindex?: boolean
}

function setMeta(selector: string, attrs: Record<string, string>, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Per-page <title>, description and share-preview tags.
 *
 * Updates the tags that index.html already ships rather than rendering new ones, so there
 * is never a second <title> or a duplicate og:* for a parser to pick wrongly. Crawlers that
 * do not run JavaScript are served the same values by the edge middleware (middleware.ts),
 * which rewrites index.html for /fabric and /supplier URLs.
 */
export function PageMeta({ title, description, image, path, noindex }: PageMetaProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE
    const desc = (description ?? DEFAULT_DESCRIPTION).replace(/\s+/g, ' ').trim().slice(0, 300)
    const url = `${SITE_URL}${path ?? window.location.pathname}`
    const img = image ?? DEFAULT_IMAGE

    document.title = fullTitle
    setMeta('meta[name="description"]', { name: 'description' }, desc)
    setMeta('meta[property="og:title"]', { property: 'og:title' }, fullTitle)
    setMeta('meta[property="og:description"]', { property: 'og:description' }, desc)
    setMeta('meta[property="og:url"]', { property: 'og:url' }, url)
    setMeta('meta[property="og:image"]', { property: 'og:image' }, img)
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title' }, fullTitle)
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description' }, desc)
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image' }, img)
    setMeta('meta[name="robots"]', { name: 'robots' }, noindex ? 'noindex, nofollow' : 'index, follow')
    setLink('canonical', url)

    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title, description, image, path, noindex])

  return null
}

export default PageMeta
