import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge'
import { InvoicePreview } from '@/components/invoice/InvoicePreview'
import { useProfile } from '@/hooks/useProfile'
import { INVOICE_SELECT, isOverdue, normalizeInvoice, outstandingPkr } from '@/lib/invoices'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import type { InvoiceWithRelations } from '@/types/app'

export default function BuyerInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useProfile()
  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null)
  const [loading, setLoading] = useState(true)

  const profileId = profile?.id

  const load = useCallback(async () => {
    if (!id || !profileId) return
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select(INVOICE_SELECT)
      .eq('id', id)
      .eq('buyer_id', profileId)
      .neq('status', 'draft')
      .maybeSingle()

    setInvoice(data ? normalizeInvoice(data as Record<string, unknown>) : null)
    setLoading(false)
  }, [id, profileId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!invoice || !profile) {
    return (
      <div className="text-center">
        <p className="text-text-secondary">Invoice not found</p>
        <Link to="/buyer/invoices" className="mt-4 inline-block text-accent hover:underline">
          Back to invoices
        </Link>
      </div>
    )
  }

  const outstanding = outstandingPkr(invoice)
  const payments = invoice.payments ?? []

  return (
    <div className="space-y-6">
      <Link
        to="/buyer/invoices"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to invoices
      </Link>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-text-dark">Invoice</CardTitle>
              <PaymentStatusBadge
                status={invoice.payment_status}
                overdue={isOverdue(invoice)}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Supplier" value={invoice.supplier?.brand_name ?? '—'} />
              <Row label="Total" value={formatPrice(invoice.subtotal_pkr ?? 0, 'PKR')} />
              <Row label="Paid" value={formatPrice(invoice.amount_paid_pkr, 'PKR')} />
              <Row label="Outstanding" value={formatPrice(outstanding, 'PKR')} emphasis />
              {invoice.due_date && (
                <Row label="Due" value={new Date(invoice.due_date).toLocaleDateString()} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-text-dark">Payments received</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-text-dark-secondary">
                  No payments recorded against this invoice yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center justify-between border-b border-border-cream pb-2 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm text-text-dark">
                          {formatPrice(payment.amount_pkr, 'PKR')}
                        </p>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                          {new Date(payment.paid_on).toLocaleDateString()}
                          {payment.method ? ` · ${payment.method.replace('_', ' ')}` : ''}
                        </p>
                      </div>
                      {payment.reference && (
                        <span className="font-mono text-[10px] text-text-dark-secondary">
                          {payment.reference}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="border border-border-cream bg-card">
          <InvoicePreview
            invoiceNumber={invoice.id.slice(0, 8).toUpperCase()}
            supplierName={invoice.supplier?.brand_name ?? 'Supplier'}
            buyerName={invoice.buyer?.company_name ?? invoice.buyer?.full_name ?? 'Buyer'}
            lineItems={invoice.line_items}
            subtotalPkr={invoice.subtotal_pkr ?? 0}
            subtotalUsd={invoice.subtotal_usd ?? 0}
            notes={invoice.notes ?? undefined}
            createdAt={invoice.created_at}
          />
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
        {label}
      </span>
      <span
        className={
          emphasis
            ? 'font-display text-sm font-semibold text-text-dark'
            : 'text-sm text-text-dark'
        }
      >
        {value}
      </span>
    </div>
  )
}
