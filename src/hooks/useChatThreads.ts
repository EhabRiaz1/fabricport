import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useCounterparties } from '@/hooks/useCounterparties'

interface ThreadRow {
  id: string
  status: string
  updatedAt: string
  buyerId: string
  supplierName: string | null
  itemCount: number
}

export interface ChatThreadSummary {
  id: string
  status: string
  updatedAt: string
  /** The other party, from whichever side the reader is on. */
  counterpartName: string
  itemCount: number
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

    const column = role === 'buyer' ? 'buyer_id' : 'supplier_id'
    const { data, error } = await supabase
      .from('inquiries')
      .select('id, status, updated_at, buyer_id, supplier:suppliers(brand_name), items:inquiry_items(count)')
      .eq(column, user.id)
      .order('updated_at', { ascending: false })
      .limit(40)

    if (error) {
      setRows([])
      setLoading(false)
      return
    }

    setRows(
      (data ?? []).map((row) => {
        const r = row as unknown as {
          id: string
          status: string
          updated_at: string
          buyer_id: string
          supplier: { brand_name: string } | null
          items: { count: number }[]
        }
        return {
          id: r.id,
          status: r.status,
          updatedAt: r.updated_at,
          buyerId: r.buyer_id,
          supplierName: r.supplier?.brand_name ?? null,
          itemCount: r.items?.[0]?.count ?? 0,
        }
      }),
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
      })),
    [rows, role, nameOf],
  )

  return { threads, loading, reload: load }
}
