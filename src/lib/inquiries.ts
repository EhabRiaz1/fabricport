import { supabase } from '@/lib/supabase'
import type { InquiryWithRelations } from '@/types/app'
import type { Profile } from '@/types/database.types'

export const INQUIRY_ITEMS_SELECT = `
  items:inquiry_items(
    *,
    product:products(*, supplier:suppliers(*), category:fabric_categories(*))
  )
`

export const INQUIRY_BASE_SELECT = `
  *,
  supplier:suppliers(*),
  buyer:buyers(
    id,
    profile:profiles(*)
  )
`

export function normalizeInquiry(raw: Record<string, unknown>): InquiryWithRelations {
  const buyerRaw = raw.buyer as { id?: string; profile?: Profile } | Profile | undefined
  const buyer =
    buyerRaw && 'profile' in buyerRaw
      ? buyerRaw.profile ?? undefined
      : (buyerRaw as Profile | undefined)

  return {
    ...(raw as unknown as InquiryWithRelations),
    buyer,
  }
}

export interface InquiryLineInput {
  product_id: string
  quantity_meters: number
  notes?: string | null
}

export interface CreateInquiryInput {
  supplierId: string
  lines: InquiryLineInput[]
  /** cart_items rows to clear in the same transaction; omit for a direct inquiry. */
  cartItemIds?: string[]
}

/**
 * Creates an inquiry and its items atomically via the `create_inquiry` RPC.
 *
 * Do NOT go back to client-side inserts: buyers have no DELETE policy on
 * `inquiries`, so a partial failure there cannot be compensated and strands an
 * empty inquiry. The RPC runs SECURITY INVOKER, so RLS is unchanged, and it
 * rejects lines that don't belong to `supplierId`.
 *
 * @returns the new inquiry id
 */
export async function createInquiry({
  supplierId,
  lines,
  cartItemIds,
}: CreateInquiryInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_inquiry', {
    p_supplier_id: supplierId,
    p_lines: lines.map((line) => ({
      product_id: line.product_id,
      quantity_meters: line.quantity_meters,
      notes: line.notes ?? null,
    })),
    p_cart_item_ids: cartItemIds ?? null,
  })

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Inquiry was not created')
  return data as string
}

export async function countUnreadMessagesForBuyer(buyerId: string): Promise<number> {
  const { data: inquiries } = await supabase
    .from('inquiries')
    .select('id')
    .eq('buyer_id', buyerId)

  const inquiryIds = (inquiries ?? []).map((i) => i.id)
  if (inquiryIds.length === 0) return 0

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .in('inquiry_id', inquiryIds)
    .is('read_at', null)
    .neq('sender_id', buyerId)

  return count ?? 0
}
