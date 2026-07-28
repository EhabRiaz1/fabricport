import { supabase } from '@/lib/supabase'
import type {
  SampleRequest,
  SampleRequestStatus,
  ShipToSnapshot,
  ShippingAddress,
} from '@/types/database.types'
import type { SampleRequestWithRelations } from '@/types/app'

export const SAMPLE_REQUEST_SELECT = `
  *,
  supplier:suppliers(*),
  buyer:buyers(
    id,
    profile:profiles(*)
  ),
  items:sample_request_items(
    *,
    product:products(*, supplier:suppliers(*))
  )
`

/**
 * The fulfilment path, in order. Drives the stepper. `declined` and `cancelled`
 * are terminal side-exits and deliberately not steps.
 */
export const SAMPLE_STEPS: SampleRequestStatus[] = [
  'requested',
  'approved',
  'shipped',
  'delivered',
]

export const SAMPLE_STATUS_LABELS: Record<SampleRequestStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  shipped: 'Shipped',
  delivered: 'Delivered',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

/** Transitions the supplier may drive. Mirrors guard_sample_request_columns. */
export const SUPPLIER_SAMPLE_TRANSITIONS: Record<string, SampleRequestStatus[]> = {
  requested: ['approved', 'declined'],
  approved: ['shipped'],
  shipped: ['delivered'],
}

export function isTerminalSampleStatus(status: SampleRequestStatus): boolean {
  return status === 'delivered' || status === 'declined' || status === 'cancelled'
}

export function normalizeSampleRequest(raw: Record<string, unknown>): SampleRequestWithRelations {
  const buyerRaw = raw.buyer as { profile?: unknown } | undefined
  return {
    ...(raw as unknown as SampleRequestWithRelations),
    buyer: (buyerRaw && 'profile' in buyerRaw ? buyerRaw.profile : buyerRaw) as never,
  }
}

/** Freezes an address-book row into the snapshot stored on the request. */
export function toShipToSnapshot(address: ShippingAddress): ShipToSnapshot {
  return {
    recipient_name: address.recipient_name,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    province: address.province,
    postal_code: address.postal_code,
    country: address.country,
  }
}

export function formatShipTo(snapshot: ShipToSnapshot): string {
  return [
    snapshot.recipient_name,
    snapshot.line1,
    snapshot.line2,
    snapshot.city,
    snapshot.province,
    snapshot.postal_code,
    snapshot.country,
  ]
    .filter(Boolean)
    .join(', ')
}

export interface CreateSampleRequestInput {
  buyerId: string
  supplierId: string
  productId: string
  address: ShippingAddress
  notes?: string | null
}

/**
 * Creates a single-product sample request plus its one item row.
 *
 * Unlike inquiries there is no RPC here: `sample_request_items` cascades from
 * `sample_requests`, so a failed item insert leaves a request the buyer CAN
 * still see and cancel — not an invisible orphan. If samples ever go
 * multi-product this should move to an RPC for the same reason inquiries did.
 */
export async function createSampleRequest({
  buyerId,
  supplierId,
  productId,
  address,
  notes,
}: CreateSampleRequestInput): Promise<SampleRequest> {
  const { data: request, error: requestError } = await supabase
    .from('sample_requests')
    .insert({
      buyer_id: buyerId,
      supplier_id: supplierId,
      ship_to: toShipToSnapshot(address),
      buyer_notes: notes ?? null,
    })
    .select('*')
    .single()

  if (requestError) throw new Error(requestError.message)

  const { error: itemError } = await supabase
    .from('sample_request_items')
    .insert({ sample_request_id: request.id, product_id: productId })

  if (itemError) throw new Error(itemError.message)

  return request as SampleRequest
}

/** Product ids this buyer already has a live (non-terminal) request for. */
export async function fetchOpenSampleProductIds(buyerId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('sample_requests')
    .select('id, status, items:sample_request_items(product_id)')
    .eq('buyer_id', buyerId)
    .in('status', ['requested', 'approved', 'shipped'])

  const ids = new Set<string>()
  for (const row of data ?? []) {
    for (const item of (row.items ?? []) as { product_id: string }[]) {
      ids.add(item.product_id)
    }
  }
  return ids
}
