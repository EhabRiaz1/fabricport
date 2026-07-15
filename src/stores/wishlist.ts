import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface WishlistState {
  ids: string[]
  loaded: boolean
  loading: boolean
  /** Load the signed-in buyer's saved product ids. */
  load: (buyerId: string) => Promise<void>
  /** Optimistically toggle; reverts on failure. Returns the new saved state. */
  toggle: (buyerId: string, productId: string) => Promise<boolean>
  has: (productId: string) => boolean
  reset: () => void
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  ids: [],
  loaded: false,
  loading: false,

  async load(buyerId) {
    set({ loading: true })
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('product_id')
      .eq('buyer_id', buyerId)
    if (error) {
      set({ loading: false })
      return
    }
    set({ ids: (data ?? []).map((r) => r.product_id), loaded: true, loading: false })
  },

  async toggle(buyerId, productId) {
    const saved = get().ids.includes(productId)
    // Optimistic update.
    set({
      ids: saved
        ? get().ids.filter((id) => id !== productId)
        : [...get().ids, productId],
    })

    if (saved) {
      const { error } = await supabase
        .from('wishlist_items')
        .delete()
        .eq('buyer_id', buyerId)
        .eq('product_id', productId)
      if (error) {
        set({ ids: [...get().ids, productId] }) // revert
        throw new Error(error.message)
      }
      return false
    }

    const { error } = await supabase
      .from('wishlist_items')
      .insert({ buyer_id: buyerId, product_id: productId })
    if (error) {
      set({ ids: get().ids.filter((id) => id !== productId) }) // revert
      throw new Error(error.message)
    }
    return true
  },

  has(productId) {
    return get().ids.includes(productId)
  },

  reset() {
    set({ ids: [], loaded: false, loading: false })
  },
}))

/** localStorage key holding a product a signed-out visitor tried to save. */
export const PENDING_WISHLIST_KEY = 'fp-pending-wishlist'
