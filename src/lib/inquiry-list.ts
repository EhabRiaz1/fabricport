import { supabase } from '@/lib/supabase'

/**
 * One row per inquiry for the list pages and the chat dock, from the
 * `get_inquiry_list_rows` RPC (SECURITY INVOKER, so RLS applies unchanged).
 *
 * The buyer's name is not in here on purpose: a supplier cannot read a buyer's
 * profile row, so supplier screens resolve `buyer_id` through
 * `useCounterparties().nameOf`, the same path every other supplier screen uses.
 */
export interface InquiryListRow {
  id: string
  status: string
  created_at: string
  updated_at: string
  buyer_id: string
  supplier_id: string
  supplier_name: string | null
  item_titles: string[]
  item_count: number
  total_meters: number
  last_message: string | null
  last_message_at: string | null
  last_message_sender: string | null
  unread_count: number
}

export async function fetchInquiryListRows(limit = 200): Promise<InquiryListRow[]> {
  // Cast until the RPC is added to database.types.ts (shared file, owned elsewhere).
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>

  const { data, error } = await rpc('get_inquiry_list_rows', { p_limit: limit })
  if (error) throw new Error(error.message)
  return ((data ?? []) as InquiryListRow[]).map((row) => ({
    ...row,
    item_titles: row.item_titles ?? [],
    total_meters: Number(row.total_meters ?? 0),
  }))
}

/** "Kabosu, Kumquat +2" — first two fabric titles, then a count. */
export function summarizeTitles(titles: string[], max = 2): string {
  if (titles.length === 0) return 'No fabrics'
  const shown = titles.slice(0, max).join(', ')
  const rest = titles.length - max
  return rest > 0 ? `${shown} +${rest}` : shown
}

export function formatMeters(meters: number): string {
  return `${Math.round(meters).toLocaleString('en-PK')} m`
}

/** Short relative stamp for list rows. */
export function relativeStamp(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

/** One-line preview of the last message, collapsing the composed opener's bullets. */
export function messagePreview(content: string | null, maxLength = 90): string {
  if (!content) return ''
  const flat = content.replace(/\s*\n\s*/g, ' · ').replace(/\s+/g, ' ').trim()
  return flat.length > maxLength ? `${flat.slice(0, maxLength - 1)}…` : flat
}
