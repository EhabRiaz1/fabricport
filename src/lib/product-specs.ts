import { formatGsm, gsmToOunces } from '@/lib/utils'
import type { ProductWithRelations } from '@/types/app'

/**
 * One reader for fabric specs, shared by the marketplace card, the quick-view modal and the
 * detail page.
 *
 * Before this, each of the three had its own private `getAttributeValue` plus its own list
 * of fallback slugs, and they had already drifted -- the card looked for `weight`, the
 * detail page also looked for `content`. The values come from two places and the precedence
 * matters, so it belongs in one file:
 *
 *   1. the promoted columns (`gsm`, `width_inches`, `composition`) and `spec_facets`, which
 *      are typed and backfilled for the whole published catalogue;
 *   2. the legacy `product_attributes` EAV rows, which are free text and may already carry
 *      their own unit, so they are printed verbatim rather than reformatted.
 */

export function getAttributeValue(
  product: ProductWithRelations,
  slug: string,
): string | null {
  const match = product.attributes?.find((attr) => attr.attribute?.slug === slug)
  if (!match) return null
  if (match.value_text) return match.value_text
  if (match.value_number != null) return String(match.value_number)
  return null
}

/**
 * The legacy control panel stored an empty construction as a shape rather than a null:
 * "0x00x0" for 366 products, "0x0x0x0" for 23 more. Printing that is worse than printing
 * nothing, so anything that is only digits, `x` and separators is treated as absent.
 */
export function isPlaceholderConstruction(value: string | null): boolean {
  if (!value) return true
  return /^[0\sxX/*+.-]*$/.test(value)
}

/** Raw GSM as a number, from the promoted column or the legacy attribute text. */
export function getGsm(product: ProductWithRelations): number | null {
  if (product.gsm != null) return product.gsm
  const raw =
    getAttributeValue(product, 'weight-before-wash') ??
    getAttributeValue(product, 'gsm') ??
    getAttributeValue(product, 'weight')
  if (!raw) return null
  const match = raw.match(/([\d.]+)/)
  return match ? Number(match[1]) : null
}

/** "185 g/m² · 5.45 oz" — both units, as the legacy site printed them. */
export function getGsmLabel(product: ProductWithRelations): string | null {
  const gsm = getGsm(product)
  if (gsm != null) return formatGsm(gsm)
  return (
    getAttributeValue(product, 'weight-before-wash') ??
    getAttributeValue(product, 'gsm') ??
    getAttributeValue(product, 'weight')
  )
}

/**
 * "185 g · 5.5 oz" — the card cells are ~130px wide at 10px mono, which is about 15
 * characters before `truncate` starts eating the ounces. The detail page uses the long
 * form; the cards use this.
 */
export function getGsmLabelShort(product: ProductWithRelations): string | null {
  const gsm = getGsm(product)
  if (gsm == null) return getGsmLabel(product)
  // Rounded: some rows carry a measured decimal ("389.9"), and "389.9 g · 11.5 oz" is
  // three characters too long for the narrowest cell — the supplier grid at four columns.
  // A tenth of a gram is not a distinction anyone buys on.
  return `${Math.round(gsm)} g · ${gsmToOunces(gsm).toFixed(1)} oz`
}

/** Width in inches as text, without the inch mark. */
export function getWidth(product: ProductWithRelations): string | null {
  if (product.width_inches != null) return String(product.width_inches)
  return (
    getAttributeValue(product, 'width-inches') ?? getAttributeValue(product, 'width')
  )
}

export function getComposition(product: ProductWithRelations): string | null {
  return (
    product.composition ??
    getAttributeValue(product, 'fabric-content') ??
    getAttributeValue(product, 'composition') ??
    getAttributeValue(product, 'content')
  )
}

/**
 * Weave for wovens, knit type for knits, construction as a last resort.
 *
 * Only 202 of the 450 published fabrics carry a weave or knit type and only 92 a usable
 * construction, so this returns null for roughly half the catalogue. That gap is upstream:
 * the legacy product pages are blank for the same rows.
 */
export function getWeaveOrKnit(product: ProductWithRelations): string | null {
  const facets = product.spec_facets ?? {}
  const fromFacets = facets.weave ?? facets.knit_type
  if (fromFacets) return fromFacets

  const fromAttrs =
    getAttributeValue(product, 'weave') ?? getAttributeValue(product, 'knit-type')
  if (fromAttrs) return fromAttrs

  const construction = getAttributeValue(product, 'construction')
  return isPlaceholderConstruction(construction) ? null : construction
}

/**
 * Yarn construction, when it is real and not already doing duty as the weave.
 *
 * `getWeaveOrKnit` falls back to construction for the fabrics that have no weave or knit
 * type, so without this check a spec table shows the same "20/1 + 10/1 + 50D" twice under
 * two different labels.
 */
export function getConstruction(product: ProductWithRelations): string | null {
  const value = getAttributeValue(product, 'construction')
  if (isPlaceholderConstruction(value)) return null
  return value === getWeaveOrKnit(product) ? null : value
}

export function getPattern(product: ProductWithRelations): string | null {
  return (
    product.spec_facets?.pattern ??
    getAttributeValue(product, 'solid-pattern-print') ??
    getAttributeValue(product, 'pattern')
  )
}

/** Availability, not fibre type: "Stock", "Made to Order", "Greige Stock". */
export function getAvailability(product: ProductWithRelations): string | null {
  return product.spec_facets?.type ?? null
}

/**
 * What the legacy card called "type of fabric": Knit / Woven / Denim. That is the category,
 * not `spec_facets.type`, which holds availability.
 */
export function getFabricType(product: ProductWithRelations): string | null {
  return product.category?.name ?? null
}

/**
 * Attribute slugs already rendered by the promoted-column rows above, so the
 * "surface everything else the mill provided" loop does not print them twice.
 */
export const PROMOTED_ATTRIBUTE_SLUGS = new Set([
  'weight-before-wash',
  'gsm',
  'weight',
  'width-inches',
  'width',
  'fabric-content',
  'composition',
  'content',
  'weave',
  'knit-type',
  'construction',
  'solid-pattern-print',
  'pattern',
  'type',
])
