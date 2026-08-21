import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Unread count for the support widget launcher.
 *
 * Head-only count on mount plus a realtime INSERT subscription, so the badge updates while
 * the panel is shut. Only ever runs for an authenticated user -- `support_messages` is
 * `TO authenticated`, so an anonymous query would just be a guaranteed-empty round trip on
 * every public page.
 */
export function useSupportUnread(userId: string | null): {
  unread: number
  clear: () => void
} {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!userId) {
      setUnread(0)
      return
    }

    let mounted = true

    void (async () => {
      const { count } = await supabase
        .from('support_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .neq('sender_id', userId)
        .is('read_at', null)
      if (mounted) setUnread(count ?? 0)
    })()

    const channel = supabase
      .channel(`support-unread:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Our own message is not unread mail.
          if ((payload.new as { sender_id: string }).sender_id === userId) return
          setUnread((n) => n + 1)
        },
      )
      .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [userId])

  return { unread, clear: () => setUnread(0) }
}
