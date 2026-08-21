import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { CartItemWithProduct, ProductWithRelations } from '@/types/app'

/**
 * A line a signed-out visitor has collected.
 *
 * Denormalised on purpose: it holds enough to render the drawer without a network call, and
 * it is discarded the moment the guest signs in and the rows land in `cart_items`.
 */
export interface GuestLine {
  product_id: string
  slug: string
  title: string
  image: string | null
  supplier_id: string | null
  supplier_name: string | null
  price_min_pkr: number | null
  moq_meters: number | null
  quantity_meters: number
}

interface CartState {
  /** Server rows for the signed-in buyer. Never persisted. */
  lines: CartItemWithProduct[]
  /** Signed-out collection. Persisted. */
  guestLines: GuestLine[]
  buyerId: string | null
  loaded: boolean
  loading: boolean

  setBuyerId: (buyerId: string | null) => void
  load: (buyerId: string) => Promise<void>
  add: (product: ProductWithRelations, quantityMeters: number) => Promise<void>
  setQuantity: (productId: string, quantityMeters: number) => Promise<void>
  setNotes: (productId: string, notes: string) => Promise<void>
  remove: (productId: string) => Promise<void>
  mergeGuestCart: (buyerId: string) => Promise<void>
  /** Clears server state on sign-out. Deliberately keeps guestLines. */
  reset: () => void
  count: () => number
}

const PRODUCT_SELECT = `
  *,
  supplier:suppliers(*),
  category:fabric_categories(*)
`

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      guestLines: [],
      buyerId: null,
      loaded: false,
      loading: false,

      setBuyerId(buyerId) {
        set({ buyerId })
      },

      async load(buyerId) {
        set({ loading: true })
        const { data, error } = await supabase
          .from('cart_items')
          .select(`*, product:products(${PRODUCT_SELECT})`)
          .eq('buyer_id', buyerId)
          .order('created_at', { ascending: false })
        if (error) {
          set({ loading: false })
          return
        }
        // Rows whose product.supplier is null are KEPT. CartPage surfaces them as an
        // "unavailable" block; filtering them here would silently delete that recovery path.
        set({
          lines: (data ?? []) as CartItemWithProduct[],
          loaded: true,
          loading: false,
          buyerId,
        })
      },

      async add(product, quantityMeters) {
        const buyerId = get().buyerId

        if (!buyerId) {
          const existing = get().guestLines.find((l) => l.product_id === product.id)
          set({
            guestLines: existing
              ? get().guestLines.map((l) =>
                  l.product_id === product.id
                    ? { ...l, quantity_meters: l.quantity_meters + quantityMeters }
                    : l,
                )
              : [
                  ...get().guestLines,
                  {
                    product_id: product.id,
                    slug: product.slug,
                    title: product.title,
                    image: product.images?.[0] ?? null,
                    supplier_id: product.supplier?.id ?? null,
                    supplier_name: product.supplier?.brand_name ?? null,
                    price_min_pkr: product.price_min_pkr,
                    moq_meters: product.moq_meters,
                    quantity_meters: quantityMeters,
                  },
                ],
          })
          return
        }

        const existing = get().lines.find((l) => l.product_id === product.id)

        // Accumulate, don't replace. The previous behaviour upserted the quantity outright,
        // so adding 200m to a cart that already held 300m left you with 200m -- the toast
        // literally apologised for it. Every other marketplace adds.
        if (existing) {
          const next = existing.quantity_meters + quantityMeters
          set({
            lines: get().lines.map((l) =>
              l.product_id === product.id ? { ...l, quantity_meters: next } : l,
            ),
          })
          const { error } = await supabase
            .from('cart_items')
            .update({ quantity_meters: next })
            .eq('id', existing.id)
          if (error) {
            set({ lines: get().lines.map((l) => (l.product_id === product.id ? existing : l)) })
            throw new Error(error.message)
          }
          return
        }

        // Insert path stays an upsert so a double-submit races safely against the
        // UNIQUE (buyer_id, product_id) constraint rather than erroring.
        const { error } = await supabase
          .from('cart_items')
          .upsert(
            { buyer_id: buyerId, product_id: product.id, quantity_meters: quantityMeters },
            { onConflict: 'buyer_id,product_id' },
          )
        if (error) throw new Error(error.message)
        await get().load(buyerId)
      },

      async setQuantity(productId, quantityMeters) {
        const buyerId = get().buyerId
        if (!buyerId) {
          set({
            guestLines: get().guestLines.map((l) =>
              l.product_id === productId ? { ...l, quantity_meters: quantityMeters } : l,
            ),
          })
          return
        }
        const previous = get().lines
        set({
          lines: previous.map((l) =>
            l.product_id === productId ? { ...l, quantity_meters: quantityMeters } : l,
          ),
        })
        const row = previous.find((l) => l.product_id === productId)
        if (!row) return
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity_meters: quantityMeters })
          .eq('id', row.id)
        if (error) {
          set({ lines: previous })
          throw new Error(error.message)
        }
      },

      async setNotes(productId, notes) {
        const buyerId = get().buyerId
        if (!buyerId) return
        const previous = get().lines
        set({
          lines: previous.map((l) => (l.product_id === productId ? { ...l, notes } : l)),
        })
        const row = previous.find((l) => l.product_id === productId)
        if (!row) return
        const { error } = await supabase
          .from('cart_items')
          .update({ notes })
          .eq('id', row.id)
        if (error) {
          set({ lines: previous })
          throw new Error(error.message)
        }
      },

      async remove(productId) {
        const buyerId = get().buyerId
        if (!buyerId) {
          set({ guestLines: get().guestLines.filter((l) => l.product_id !== productId) })
          return
        }
        const previous = get().lines
        const row = previous.find((l) => l.product_id === productId)
        set({ lines: previous.filter((l) => l.product_id !== productId) })
        if (!row) return
        const { error } = await supabase.from('cart_items').delete().eq('id', row.id)
        if (error) {
          set({ lines: previous })
          throw new Error(error.message)
        }
      },

      async mergeGuestCart(buyerId) {
        const guestLines = get().guestLines
        if (guestLines.length === 0) return

        const { data: existing } = await supabase
          .from('cart_items')
          .select('product_id, quantity_meters')
          .eq('buyer_id', buyerId)
        const byProduct = new Map(
          (existing ?? []).map((r) => [r.product_id, Number(r.quantity_meters)]),
        )

        // MAX, not SUM. A guest line is almost always the same intent re-expressed after
        // signing in ("I want 500m of this"), so summing double-counts it.
        const rows = guestLines.map((line) => ({
          buyer_id: buyerId,
          product_id: line.product_id,
          quantity_meters: Math.max(
            line.quantity_meters,
            byProduct.get(line.product_id) ?? 0,
          ),
        }))

        const { error } = await supabase
          .from('cart_items')
          .upsert(rows, { onConflict: 'buyer_id,product_id' })
        // Keep the guest lines on failure so nothing is silently lost.
        if (error) return
        set({ guestLines: [] })
        await get().load(buyerId)
      },

      reset() {
        set({ lines: [], buyerId: null, loaded: false })
      },

      count() {
        const { buyerId, lines, guestLines } = get()
        return buyerId ? lines.length : guestLines.length
      },
    }),
    {
      name: 'fabricport-cart',
      // Only the guest collection survives a reload. Persisting server-backed lines would
      // resurrect rows deleted elsewhere and leak one user's cart to the next person on a
      // shared machine.
      partialize: (state) => ({ guestLines: state.guestLines }),
    },
  ),
)

/** Reactive item count for the nav badge. */
export function useCartCount(): number {
  return useCartStore((s) => (s.buyerId ? s.lines.length : s.guestLines.length))
}
