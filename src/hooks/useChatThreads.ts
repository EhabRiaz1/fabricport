import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCounterparties } from '@/hooks/useCounterparties'
import { fetchInquiryListRows, messagePreview } from '@/lib/inquiry-list'

interface ThreadRow {
  id: string
  status: string
  updatedAt: string
  buyerId: string
  supplierName: string | null
  itemCount: number
  itemTitles: string[]
  lastMessage: string | null
  unreadCount: number
}

export interface ChatThreadSummary {
  id: string
  status: string
  updatedAt: string
  /** The other party, from whichever side the reader is on. */
  counterpartName: string
  itemCount: number
  itemTitles: string[]
  /** One-line preview of the latest message, if any. */
  lastMessage: string | null
  unreadCount: number
}

/**
 * The reader's inquiry conversations, for the dock's list view.
 *
 * Works from either side: a buyer sees their suppliers, a supplier sees their buyers. The
 * inquiries table is already gated by RLS to rows the reader is party to, so the role only
 * decides which column to filter on and which name to show.
 *
 * Fetching and name resolution are deliberately separate. `useCounterparties` returns a fresh
 * `nameOf` closure on every render, so folding it into the fetch callback made that callback
 * -- and therefore the effect depending on it -- unstable, and the list re-fetched forever
 * without ever leaving its loading state. The query depends only on the identity; names are
 * applied during render.
 */
export function useChatThreads(enabled: boolean) {
  const { user, role } = useAuth()
  // A supplier cannot read a buyer's profiles row -- profiles_select_own_or_admin blocks it,
  // so a nested join returns null. get_counterparty_profiles is the SECURITY DEFINER path
  // that exposes just the names of people you actually transact with.
  const { nameOf } = useCounterparties()
  const [rows, setRows] = useState<ThreadRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user || (role !== 'buyer' && role !== 'supplier')) {
      setRows([])
      return
    }
    setLoading(true)

    // get_inquiry_list_rows is SECURITY INVOKER: RLS already limits it to the
    // inquiries this user is party to, from either side.
    let data: Awaited<ReturnType<typeof fetchInquiryListRows>>
    try {
      data = await fetchInquiryListRows(40)
    } catch {
      setRows([])
      setLoading(false)
      return
    }

    setRows(
      data.map((r) => ({
        id: r.id,
        status: r.status,
        updatedAt: r.last_message_at ?? r.updated_at,
        buyerId: r.buyer_id,
        supplierName: r.supplier_name,
        itemCount: r.item_count,
        itemTitles: r.item_titles,
        lastMessage: r.last_message ? messagePreview(r.last_message, 70) : null,
        unreadCount: r.unread_count,
      })),
    )
    setLoading(false)
  }, [user, role])

  useEffect(() => {
    if (!enabled) return
    void load()
  }, [enabled, load])

  const threads = useMemo<ChatThreadSummary[]>(
    () =>
      rows.map((r) => ({
        id: r.id,
        status: r.status,
        updatedAt: r.updatedAt,
        counterpartName:
          role === 'buyer' ? (r.supplierName ?? 'Supplier') : nameOf(r.buyerId, 'Buyer'),
        itemCount: r.itemCount,
        itemTitles: r.itemTitles,
        lastMessage: r.lastMessage,
        unreadCount: r.unreadCount,
      })),
    [rows, role, nameOf],
  )

  return { threads, loading, reload: load }
}
