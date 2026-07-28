import { supabase } from '@/lib/supabase'
import type { PaymentStatus, PaymentMethod } from '@/types/database.types'
import type { InvoiceWithRelations } from '@/types/app'

export const INVOICE_SELECT = `
  *,
  supplier:suppliers(id, brand_name, slug),
  buyer:buyers(id, profile:profiles(id, full_name, company_name)),
  payments(*)
`

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Part paid',
  paid: 'Paid',
}

export function normalizeInvoice(raw: Record<string, unknown>): InvoiceWithRelations {
  const buyerRaw = raw.buyer as { profile?: unknown } | undefined
  return {
    ...(raw as unknown as InvoiceWithRelations),
    buyer: (buyerRaw && 'profile' in buyerRaw ? buyerRaw.profile : buyerRaw) as never,
  }
}

export function outstandingPkr(invoice: {
  subtotal_pkr: number | null
  amount_paid_pkr: number
}): number {
  return Math.max(0, (invoice.subtotal_pkr ?? 0) - invoice.amount_paid_pkr)
}

/**
 * Mirrors the SQL definition in the WS3 migration (eng-H3). A draft is never
 * overdue: it has no due_date at all, because due_date is stamped on send.
 */
export function isOverdue(invoice: {
  status: string
  payment_status: PaymentStatus
  due_date: string | null
}): boolean {
  if (!invoice.due_date) return false
  if (!['sent', 'acknowledged'].includes(invoice.status)) return false
  if (invoice.payment_status === 'paid') return false
  return new Date(invoice.due_date) < new Date()
}

export interface RecordPaymentInput {
  invoiceId: string
  amountPkr: number
  paidOn?: string
  method?: PaymentMethod | null
  reference?: string | null
}

/**
 * Admin-only (enforced by the payments_admin_write policy). Inserting the row is
 * the whole operation — `invoices.amount_paid_pkr` and `payment_status` are
 * recomputed by the recalc_invoice_payment_totals trigger, never written here.
 */
export async function recordPayment({
  invoiceId,
  amountPkr,
  paidOn,
  method,
  reference,
}: RecordPaymentInput): Promise<void> {
  const { error } = await supabase.from('payments').insert({
    invoice_id: invoiceId,
    amount_pkr: amountPkr,
    ...(paidOn ? { paid_on: paidOn } : {}),
    method: method ?? null,
    reference: reference?.trim() || null,
  })
  if (error) throw new Error(error.message)
}

export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId)
  if (error) throw new Error(error.message)
}
