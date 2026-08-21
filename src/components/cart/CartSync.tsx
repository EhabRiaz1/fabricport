import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useCartStore } from '@/stores/cart'

/**
 * Keeps the cart store in sync with auth. Renders nothing.
 *
 * Mirrors `WishlistSync`: loads the buyer's rows on sign-in, folds in anything they
 * collected while signed out, and clears server state on sign-out.
 *
 * The persisted `guestLines` array IS the pending-intent replay -- it holds every item, not
 * just the last one, so it does not need wishlist's single-key `PENDING_WISHLIST_KEY` hack.
 * It is deliberately NOT cleared on sign-out: a supplier browsing the marketplace should not
 * see a buyer's cart, but a signed-out visitor should not lose theirs either.
 */
export function CartSync() {
  const { isAuthenticated, role, user } = useAuth()
  const load = useCartStore((s) => s.load)
  const setBuyerId = useCartStore((s) => s.setBuyerId)
  const mergeGuestCart = useCartStore((s) => s.mergeGuestCart)
  const reset = useCartStore((s) => s.reset)

  useEffect(() => {
    if (!isAuthenticated || role !== 'buyer' || !user) {
      reset()
      return
    }

    let cancelled = false
    void (async () => {
      setBuyerId(user.id)
      await load(user.id)
      if (cancelled) return
      await mergeGuestCart(user.id).catch(() => undefined)
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, role, user, load, setBuyerId, mergeGuestCart, reset])

  return null
}

export default CartSync
