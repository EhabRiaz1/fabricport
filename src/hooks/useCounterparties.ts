import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface CounterpartyProfile {
  id: string
  full_name: string | null
  company_name: string | null
}

/**
 * Names of the people you actually transact with.
 *
 * Needed because `profiles_select_own_or_admin` blocks a supplier from reading a
 * buyer's profile row, so a nested `buyer:buyers(profile:profiles(...))` join
 * silently returns null for suppliers. Backed by the get_counterparty_profiles
 * SECURITY DEFINER function, which exposes only id/full_name/company_name.
 */
export function useCounterparties() {
  const [byId, setById] = useState<Record<string, CounterpartyProfile>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase.rpc('get_counterparty_profiles')
      if (cancelled) return
      const map: Record<string, CounterpartyProfile> = {}
      for (const row of (data ?? []) as CounterpartyProfile[]) map[row.id] = row
      setById(map)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  /** Best available display name, falling back to the supplied label. */
  function nameOf(id: string | null | undefined, fallback = '—'): string {
    if (!id) return fallback
    const row = byId[id]
    return row?.company_name || row?.full_name || fallback
  }

  return { byId, nameOf, loading }
}
