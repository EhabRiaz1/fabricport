import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

const SESSION_KEY = 'fp-session-id'

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/** Fire-and-forget catalogue/product view event for supplier analytics. */
export function trackSupplierView(input: {
  supplierId: string
  productId?: string
  viewerId?: string | null
}): void {
  supabase
    .from('supplier_page_views')
    .insert({
      supplier_id: input.supplierId,
      product_id: input.productId ?? null,
      viewer_id: input.viewerId ?? null,
      session_id: getSessionId(),
      referrer: document.referrer || null,
    })
    .then(({ error }) => {
      if (error) console.warn('view tracking failed:', error.message)
    })
}

export interface PresenceMeta {
  path: string
  /** Supplier whose catalogue/product is being viewed, if any. */
  supplierId?: string
  [key: string]: string | undefined
}

export interface PresenceEntry {
  session: string
  path: string
  supplierId?: string
  role?: string
  company?: string
  online_at: string
}

export const SITE_PRESENCE_CHANNEL = 'site-presence'

/**
 * Joins the global realtime presence channel so admins (live monitor) and
 * suppliers (catalogue analytics) can see who is on which page right now.
 */
export function usePagePresence(meta: PresenceMeta) {
  const { profile } = useAuth()
  const role = profile?.role
  const company = profile?.company_name ?? profile?.full_name ?? undefined
  const { path, supplierId } = meta

  useEffect(() => {
    const session = getSessionId()
    const channel = supabase.channel(SITE_PRESENCE_CHANNEL, {
      config: { presence: { key: session } },
    })

    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      const entry: PresenceEntry = {
        session,
        path,
        supplierId,
        role,
        company,
        online_at: new Date().toISOString(),
      }
      void channel.track(entry)
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [path, supplierId, role, company])
}

/** Subscribe to the global presence channel and receive the live entry list. */
export function subscribePresence(
  onChange: (entries: PresenceEntry[]) => void,
): () => void {
  const channel = supabase.channel(SITE_PRESENCE_CHANNEL, {
    config: { presence: { key: `observer-${getSessionId()}` } },
  })

  function emit() {
    const state = channel.presenceState<PresenceEntry>()
    const entries = Object.values(state)
      .flat()
      .filter((entry) => entry.path)
    onChange(entries)
  }

  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
