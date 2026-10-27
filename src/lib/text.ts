/** "1 fabric", "12 fabrics". Pass an explicit plural for irregular nouns. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  const n = Number.isFinite(count) ? count : 0
  return `${n.toLocaleString()} ${n === 1 ? singular : plural}`
}

/**
 * A supplier's optional extra badge text, or null when it would only repeat the VERIFIED
 * badge (which comes from `is_verified`, never from this label).
 */
export function extraBadgeLabel(label: string | null | undefined): string | null {
  const trimmed = label?.trim()
  if (!trimmed || /^verified( (mill|supplier|vendor))?$/i.test(trimmed)) return null
  return trimmed
}

/** The noun alone, for sentences that already carry the number. */
export function pluralNoun(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural
}
