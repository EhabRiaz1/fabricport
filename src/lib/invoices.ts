import { supabase } from '@/lib/supabase'
import type {
  Invoice,
  InvoiceStatus,
  InvoiceTaxMode,
  PaymentStatus,
  PaymentMethod,
} from '@/types/database.types'
import type { InvoiceWithRelations } from '@/types/app'
import type { InvoicePDFProps } from '@/components/invoice/InvoicePDF'

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

/** Grand total (subtotal + tax + freight). Legacy rows without total_pkr fall back to the subtotal. */
export function invoiceTotalPkr(invoice: {
  subtotal_pkr: number | null
  total_pkr?: number | null
}): number {
  return invoice.total_pkr ?? invoice.subtotal_pkr ?? 0
}

export function outstandingPkr(invoice: {
  subtotal_pkr: number | null
  total_pkr?: number | null
  amount_paid_pkr: number
}): number {
  return Math.max(0, invoiceTotalPkr(invoice) - invoice.amount_paid_pkr)
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  acknowledged: 'Acknowledged',
  cancelled: 'Cancelled',
}

export interface InvoiceTotalsInput {
  lines: { qty: number; unit_price_pkr: number; unit_price_usd?: number; tax_rate_percent?: number | null }[]
  taxMode: InvoiceTaxMode
  taxRatePercent: number
  freightPkr: number
}

/**
 * Client mirror of the compute_invoice_totals trigger (migration 20261027150000),
 * used for the live builder preview. The database recomputes on every write, so
 * the stored figures are always the server's.
 */
export function computeInvoiceTotals({ lines, taxMode, taxRatePercent, freightPkr }: InvoiceTotalsInput) {
  let subtotalPkr = 0
  let subtotalUsd = 0
  let taxPkr = 0
  for (const line of lines) {
    const amount = line.qty * line.unit_price_pkr
    subtotalPkr += amount
    subtotalUsd += line.qty * (line.unit_price_usd ?? 0)
    if (taxMode === 'per_line') {
      taxPkr += (amount * (line.tax_rate_percent ?? taxRatePercent)) / 100
    }
  }
  if (taxMode === 'total') taxPkr = (subtotalPkr * taxRatePercent) / 100
  const round2 = (n: number) => Math.round(n * 100) / 100
  return {
    subtotalPkr: round2(subtotalPkr),
    subtotalUsd: round2(subtotalUsd),
    taxPkr: round2(taxPkr),
    totalPkr: round2(subtotalPkr + taxPkr + freightPkr),
  }
}

/** Props for InvoicePDF / InvoicePreview from a stored invoice row. */
export function invoicePdfProps(invoice: Invoice, names: { supplierName: string; buyerName: string }): InvoicePDFProps {
  return {
    invoiceNumber: invoice.id.slice(0, 8).toUpperCase(),
    supplierName: names.supplierName,
    buyerName: names.buyerName,
    lineItems: invoice.line_items,
    subtotalPkr: invoice.subtotal_pkr ?? 0,
    subtotalUsd: invoice.subtotal_usd ?? 0,
    taxMode: invoice.tax_mode ?? 'total',
    taxRatePercent: invoice.tax_rate_percent ?? 0,
    taxPkr: invoice.tax_pkr ?? 0,
    freightPkr: invoice.freight_pkr ?? 0,
    totalPkr: invoiceTotalPkr(invoice),
    paymentTerms: invoice.payment_terms ?? undefined,
    dueDate: invoice.due_date ?? undefined,
    notes: invoice.notes ?? undefined,
    createdAt: invoice.sent_at ?? invoice.created_at,
    status: invoice.status,
  }
}

/** Renders the invoice PDF in the browser and triggers a download. */
export async function downloadInvoicePdf(props: InvoicePDFProps): Promise<void> {
  const [{ pdf }, { InvoicePDF }, { createElement }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/invoice/InvoicePDF'),
    import('react'),
  ])
  // InvoicePDF renders a <Document>; react-pdf's typing only accepts the Document element itself.
  const element = createElement(InvoicePDF, props) as unknown as Parameters<typeof pdf>[0]
  const blob = await pdf(element).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoice-${props.invoiceNumber}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Mirrors the SQL definition in the WS3 migration (eng-H3). Only sent /
 * acknowledged invoices can be overdue; a draft may carry a supplier-chosen
 * due date but is not yet owed.
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
