import { create } from 'zustand'
import { createInquiry } from '@/lib/inquiries'
import { dispatchNotification } from '@/lib/notifications'
import type { CartGroupBySupplier, CartItemWithProduct } from '@/types/app'

/** Just the fields the notification copy needs -- avoids importing the full Profile row. */
type InquirySender = { id: string; company_name: string | null; full_name: string | null }

/**
 * Cart logic shared by the full page and the nav drawer.
 *
 * Extracted so the two surfaces cannot drift: the grouping, the estimate and the submit
 * transaction all lived inside CartPage, which meant a drawer would have had to reimplement
 * the partial-failure recovery and the "supplier could not be resolved" handling.
 */

export function groupBySupplier(items: CartItemWithProduct[]): CartGroupBySupplier[] {
  const map = new Map<string, CartGroupBySupplier>()
  for (const item of items) {
    const supplier = item.product?.supplier
    if (!supplier) continue
    const existing = map.get(supplier.id)
    if (existing) existing.items.push(item)
    else map.set(supplier.id, { supplier, items: [item] })
  }
  return Array.from(map.values())
}

/** Items whose supplier could not be resolved (RLS, or a deleted supplier). */
export function unavailableItems(items: CartItemWithProduct[]): CartItemWithProduct[] {
  return items.filter((item) => !item.product?.supplier)
}

export function groupEstimate(group: CartGroupBySupplier): number {
  return group.items.reduce(
    (sum, item) => sum + (item.product.price_min_pkr ?? 0) * item.quantity_meters,
    0,
  )
}

export interface SubmitResult {
  sent: number
  total: number
  error: string | null
}

/**
 * One inquiry per supplier.
 *
 * Each group is its own `create_inquiry` RPC, i.e. its own transaction: the inquiry, its
 * items and the cart cleanup either all land or none do. This must stay an RPC -- buyers
 * have no DELETE policy on `inquiries`, so a client-side multi-step version could not clean
 * up after a partial failure.
 */
export async function submitCartInquiries(
  profile: InquirySender,
  groups: CartGroupBySupplier[],
): Promise<SubmitResult> {
  let sent = 0
  try {
    for (const group of groups) {
      const inquiryId = await createInquiry({
        supplierId: group.supplier.id,
        lines: group.items.map((item) => ({
          product_id: item.product_id,
          quantity_meters: item.quantity_meters,
          notes: item.notes,
        })),
        cartItemIds: group.items.map((item) => item.id),
      })
      sent += 1

      // Fan-out only (in-app / email / WhatsApp). The inquiry is already committed, so a
      // failure here must not surface as a failed submission.
      dispatchNotification({
        userId: group.supplier.id,
        type: 'inquiry_received',
        title: 'New inquiry received',
        body: `${profile.company_name ?? profile.full_name ?? 'A buyer'} sent an inquiry for ${group.items.length} fabric${group.items.length === 1 ? '' : 's'}.`,
        data: { inquiry_id: inquiryId },
      }).catch(() => undefined)
    }
    return { sent, total: groups.length, error: null }
  } catch (err) {
    // An earlier group may already have committed, so the caller must re-read the cart.
    const message = err instanceof Error ? err.message : 'Failed to submit inquiries'
    return {
      sent,
      total: groups.length,
      error: sent > 0 ? `${message} (${sent} of ${groups.length} inquiries were sent)` : message,
    }
  }
}

/**
 * Open/closed state for the nav drawer.
 *
 * Its own tiny store rather than page state, because PublicNav opens it, the drawer closes
 * it, and the chat launcher hides itself while it is open.
 */
interface CartUIState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useCartUI = create<CartUIState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
