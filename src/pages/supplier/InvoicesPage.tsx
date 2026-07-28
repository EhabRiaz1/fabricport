import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge'
import { useCounterparties } from '@/hooks/useCounterparties'
import { useProfile } from '@/hooks/useProfile'
import { INVOICE_SELECT, isOverdue, normalizeInvoice, outstandingPkr } from '@/lib/invoices'
import { dispatchNotification } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { InvoiceWithRelations } from '@/types/app'

/**
 * Suppliers could create invoices but never see them again — InvoiceBuilderPage
 * inserted a draft and there was no list and no send action anywhere in the app.
 * That made the whole invoice table write-only: a draft never reaches the buyer,
 * never gets a due_date, and can never be paid. This page closes that loop.
 */
export default function SupplierInvoicesPage() {
  const { profile } = useProfile()
  const { nameOf } = useCounterparties()
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)

  const profileId = profile?.id

  const load = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select(INVOICE_SELECT)
      .eq('supplier_id', profileId)
      .order('created_at', { ascending: false })
    setInvoices((data ?? []).map((r) => normalizeInvoice(r as Record<string, unknown>)))
    setLoading(false)
  }, [profileId])

  useEffect(() => {
    load()
  }, [load])

  async function send(invoice: InvoiceWithRelations) {
    setSending(invoice.id)
    // sent_at and due_date (sent_at + 30 days) are stamped by the DB guard —
    // deliberately not set here, so a client cannot choose its own due date.
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'sent' })
      .eq('id', invoice.id)
    setSending(null)

    if (error) {
      toast.error('Could not send invoice', error.message)
      return
    }

    dispatchNotification({
      userId: invoice.buyer_id,
      type: 'invoice_sent',
      title: 'New invoice',
      body: `${profile?.company_name ?? 'A supplier'} issued an invoice for ${formatPrice(
        invoice.subtotal_pkr ?? 0,
        'PKR',
      )}.`,
      data: { invoice_id: invoice.id },
    }).catch(() => undefined)

    toast.success('Invoice sent', 'The buyer can now see it. Payment terms are 30 days.')
    await load()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Orders</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">Invoices</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Invoices you've issued. Drafts are private until you send them.
        </p>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-text-muted" />
            <p className="mt-4 text-text-dark-secondary">No invoices yet.</p>
            <p className="mt-1 text-sm text-text-dark-secondary">
              Open an inquiry and choose "Create Invoice" to raise one.
            </p>
            <Button asChild className="mt-5" variant="outline">
              <Link to="/supplier-portal/inquiries">Go to inquiries</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex flex-wrap items-center justify-between gap-3 border border-border-cream bg-card p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-dark">
                  {/* Not invoice.buyer — RLS hides the buyer's profile row from
                      suppliers, so the nested join comes back null. */}
                  {nameOf(invoice.buyer_id, 'Buyer')}
                </p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                  {new Date(invoice.created_at).toLocaleDateString()}
                  {invoice.due_date &&
                    ` · due ${new Date(invoice.due_date).toLocaleDateString()}`}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-display text-sm font-semibold text-text-dark">
                    {formatPrice(invoice.subtotal_pkr ?? 0, 'PKR')}
                  </p>
                  {invoice.status !== 'draft' && outstandingPkr(invoice) > 0 && (
                    <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                      {formatPrice(outstandingPkr(invoice), 'PKR')} outstanding
                    </p>
                  )}
                </div>

                {invoice.status === 'draft' ? (
                  <Button
                    size="sm"
                    disabled={sending === invoice.id || invoice.subtotal_pkr == null}
                    title={
                      invoice.subtotal_pkr == null
                        ? 'This invoice has no subtotal and cannot be sent'
                        : undefined
                    }
                    onClick={() => send(invoice)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sending === invoice.id ? 'Sending…' : 'Send'}
                  </Button>
                ) : (
                  <PaymentStatusBadge
                    status={invoice.payment_status}
                    overdue={isOverdue(invoice)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
