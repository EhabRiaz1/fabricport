import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useWishlistStore, PENDING_WISHLIST_KEY } from '@/stores/wishlist'
import { useToastStore } from '@/stores/toast'

export interface WishlistButtonProps {
  productId: string
  className?: string
}

/**
 * Heart toggle for saving a fabric to the buyer wishlist. Rendered as a sibling
 * of the card's stretched link, so it never nests a button inside an anchor.
 * Signed-out visitors are sent to sign in with their intent preserved.
 */
export function WishlistButton({ productId, className }: WishlistButtonProps) {
  const { isAuthenticated, role, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const saved = useWishlistStore((s) => s.ids.includes(productId))
  const toggle = useWishlistStore((s) => s.toggle)
  const pushToast = useToastStore((s) => s.push)
  const [busy, setBusy] = useState(false)

  // Suppliers and admins don't have a buyer wishlist.
  if (isAuthenticated && role !== 'buyer') return null

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!isAuthenticated || !user) {
      try {
        localStorage.setItem(PENDING_WISHLIST_KEY, productId)
      } catch {
        // ignore storage failures (private mode)
      }
      pushToast({ title: 'Sign in to save fabrics to your wishlist', variant: 'default' })
      navigate('/auth/login', { state: { from: location.pathname } })
      return
    }

    setBusy(true)
    try {
      const nowSaved = await toggle(user.id, productId)
      pushToast({
        title: nowSaved ? 'Saved to wishlist' : 'Removed from wishlist',
        variant: 'success',
      })
    } catch {
      pushToast({ title: 'Could not update wishlist', variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      aria-pressed={saved}
      className={cn(
        'grid h-9 w-9 place-items-center border shadow-sm transition-colors clip-corner-sm',
        saved
          ? 'border-accent bg-accent text-white'
          : 'border-border-cream bg-card/90 text-text-dark hover:border-accent hover:text-accent',
        className,
      )}
    >
      <Heart className={cn('h-4 w-4', saved && 'fill-current')} />
    </button>
  )
}

export default WishlistButton
