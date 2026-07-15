import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useWishlistStore, PENDING_WISHLIST_KEY } from '@/stores/wishlist'

/**
 * Keeps the wishlist store in sync with auth: loads a buyer's saved fabrics on
 * sign-in, replays a save a signed-out visitor attempted, and clears on sign-out.
 * Renders nothing.
 */
export function WishlistSync() {
  const { isAuthenticated, role, user } = useAuth()
  const load = useWishlistStore((s) => s.load)
  const toggle = useWishlistStore((s) => s.toggle)
  const reset = useWishlistStore((s) => s.reset)

  useEffect(() => {
    if (!isAuthenticated || role !== 'buyer' || !user) {
      reset()
      return
    }

    let cancelled = false
    void (async () => {
      await load(user.id)
      if (cancelled) return

      // Replay a pending save captured before the visitor signed in.
      let pending: string | null
      try {
        pending = localStorage.getItem(PENDING_WISHLIST_KEY)
      } catch {
        pending = null
      }
      if (pending && !useWishlistStore.getState().ids.includes(pending)) {
        await toggle(user.id, pending).catch(() => undefined)
      }
      try {
        localStorage.removeItem(PENDING_WISHLIST_KEY)
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, role, user, load, toggle, reset])

  return null
}

export default WishlistSync
