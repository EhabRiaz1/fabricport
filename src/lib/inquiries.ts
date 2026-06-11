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
