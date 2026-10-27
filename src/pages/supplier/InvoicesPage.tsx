import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Download, Eye, FileText, Pencil, Send, X } from 'lucide-react'
import { InvoicePreview } from '@/components/invoice/InvoicePreview'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge'
import { useCounterparties } from '@/hooks/useCounterparties'
import { useProfile } from '@/hooks/useProfile'
import {
  INVOICE_SELECT,
  INVOICE_STATUS_LABELS,
  downloadInvoicePdf,
  invoicePdfProps,
  invoiceTotalPkr,
  isOverdue,
  normalizeInvoice,
  outstandingPkr,
} from '@/lib/invoices'
import { dispatchNotification } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { cn, formatPrice } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { InvoiceWithRelations } from '@/types/app'

type PendingAction = { kind: 'send' | 'cancel'; invoice: InvoiceWithRelations }

/**
 * Suppliers could create invoices but never see them again — InvoiceBuilderPage
 * inserted a draft and there was no list and no send action anywhere in the app.
 * That made the whole invoice table write-only: a draft never reaches the buyer,
 * never gets a due_date, and can never be paid. This page closes that loop.
 */
export default function SupplierInvoicesPage() {
  const { profile } = useProfile()
  const { nameOf } = useCounterparties()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const busyRef = useRef(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [viewing, setViewing] = useState<InvoiceWithRelations | null>(null)
  const highlightRef = useRef<HTMLDivElement | null>(null)

  const profileId = profile?.id

  /** `quiet` refreshes without the skeleton, so the list does not flash after an action. */
  const load = useCallback(
    async (quiet = false) => {
      if (!profileId) return
      if (!quiet) setLoading(true)
      const { data, error } = await supabase
        .from('invoices')
        .select(INVOICE_SELECT)
        .eq('supplier_id', profileId)
        .order('created_at', { ascending: false })
      if (error) setLoadError(error.message)
      else {
        setLoadError(null)
        setInvoices((data ?? []).map((r) => normalizeInvoice(r as Record<string, unknown>)))
      }
      setLoading(false)
    },
    [profileId],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!loading && highlightId) {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [loading, highlightId])

  const buyerName = (invoice: InvoiceWithRelations) =>
    // Not invoice.buyer — RLS hides the buyer's profile row from suppliers, so
    // the nested join comes back null.
    nameOf(invoice.buyer_id, 'Buyer')

  const pdfPropsFor = (invoice: InvoiceWithRelations) =>
    invoicePdfProps(invoice, {
      supplierName: invoice.supplier?.brand_name ?? profile?.company_name ?? 'Supplier',
      buyerName: buyerName(invoice),
    })

  async function send(invoice: InvoiceWithRelations) {
    if (busyRef.current) return
    busyRef.current = true
    setBusyId(invoice.id)
    // sent_at (and due_date, when the supplier left it blank) are stamped by the
    // DB guard on the draft → sent transition.
    const { data, error } = await supabase
      .from('invoices')
      .update({ status: 'sent' })
      .eq('id', invoice.id)
      .eq('status', 'draft')
      .select('due_date, total_pkr')
      .maybeSingle()
    busyRef.current = false
    setBusyId(null)
    setPending(null)

    if (error || !data) {
      toast.error('Could not send invoice', error?.message ?? 'It may already have been sent.')
      await load(true)
      return
    }

    const total = formatPrice(data.total_pkr ?? invoiceTotalPkr(invoice), 'PKR')
    dispatchNotification({
      userId: invoice.buyer_id,
      type: 'invoice_sent',
      title: 'New invoice',
      body: `${profile?.company_name ?? 'A supplier'} issued an invoice for ${total}.`,
      data: { invoice_id: invoice.id },
    }).catch(() => undefined)

    const due = data.due_date ? ` Due ${new Date(data.due_date).toLocaleDateString()}.` : ''
    toast.success('Invoice sent', `${buyerName(invoice)} can now see it.${due}`)
    await load(true)
  }

  async function cancel(invoice: InvoiceWithRelations) {
    if (busyRef.current) return
    busyRef.current = true
    setBusyId(invoice.id)
    const { data, error } = await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', invoice.id)
      .in('status', ['draft', 'sent'])
      .select('id')
      .maybeSingle()
    busyRef.current = false
    setBusyId(null)
    setPending(null)

    if (error || !data) {
      toast.error('Could not cancel invoice', error?.message ?? 'Its status has changed.')
      await load(true)
      return
    }
    toast.success(invoice.status === 'draft' ? 'Draft cancelled' : 'Invoice cancelled')
    await load(true)
  }

  async function download(invoice: InvoiceWithRelations) {
    setBusyId(invoice.id)
    try {
      await downloadInvoicePdf(pdfPropsFor(invoice))
    } catch (e) {
      toast.error('Could not create the PDF', e instanceof Error ? e.message : undefined)
    } finally {
      setBusyId(null)
    }
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
          {loadError && <p className="text-sm text-danger">{loadError}</p>}
          {invoices.map((invoice) => {
            const isDraft = invoice.status === 'draft'
            const isCancelled = invoice.status === 'cancelled'
            const busy = busyId === invoice.id
            const highlighted = invoice.id === highlightId
            const total = invoiceTotalPkr(invoice)
            return (
              <div
                key={invoice.id}
                ref={highlighted ? highlightRef : undefined}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-3 border bg-card p-4 transition-shadow',
                  highlighted ? 'border-accent ring-2 ring-accent/40' : 'border-border-cream',
                  isCancelled && 'opacity-70',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-text-dark">
                      {buyerName(invoice)}
                    </p>
                    <Badge variant={isCancelled ? 'danger' : 'status'}>
                      {INVOICE_STATUS_LABELS[invoice.status]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                    #{invoice.id.slice(0, 8).toUpperCase()} ·{' '}
                    {new Date(invoice.created_at).toLocaleDateString()}
                    {invoice.due_date &&
                      ` · due ${new Date(invoice.due_date).toLocaleDateString()}`}
                    {invoice.payment_terms && ` · ${invoice.payment_terms}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <div className="text-right">
                    <p className="font-display text-sm font-semibold text-text-dark">
                      {formatPrice(total, 'PKR')}
                    </p>
                    {!isDraft && !isCancelled && (
                      // Read-only: payments are recorded by FabricPort admin.
                      <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                        {formatPrice(invoice.amount_paid_pkr, 'PKR')} paid
                        {outstandingPkr(invoice) > 0 &&
                          ` · ${formatPrice(outstandingPkr(invoice), 'PKR')} outstanding`}
                      </p>
                    )}
                  </div>

                  {!isDraft && !isCancelled && (
                    <PaymentStatusBadge
                      status={invoice.payment_status}
                      overdue={isOverdue(invoice)}
                    />
                  )}

                  <div className="flex flex-wrap gap-2">
                    {isDraft ? (
                      <>
                        <Button size="sm" variant="outline" className={OUTLINE} asChild>
                          <Link to={`/supplier-portal/invoices/new?invoice=${invoice.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                            Open / Edit
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          disabled={busy || invoice.total_pkr == null}
                          title={
                            invoice.total_pkr == null
                              ? 'Open and save this draft to calculate its total'
                              : undefined
                          }
                          onClick={() => setPending({ kind: 'send', invoice })}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Send
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className={OUTLINE}
                          onClick={() => setViewing(invoice)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={OUTLINE}
                          disabled={busy}
                          onClick={() => download(invoice)}
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      </>
                    )}
                    {(isDraft || invoice.status === 'sent') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-text-dark-secondary hover:text-danger"
                        disabled={busy}
                        onClick={() => setPending({ kind: 'cancel', invoice })}
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={!!pending} onOpenChange={(open) => !open && !busyId && setPending(null)}>
        <DialogContent className="border-border-cream bg-card text-text-dark">
          {pending && (
            <>
              <DialogHeader>
                <DialogTitle className="text-text-dark">
                  {pending.kind === 'send'
                    ? 'Send this invoice?'
                    : pending.invoice.status === 'draft'
                      ? 'Cancel this draft?'
                      : 'Cancel this sent invoice?'}
                </DialogTitle>
                <DialogDescription className="text-text-dark-secondary">
                  {pending.kind === 'send'
                    ? `${buyerName(pending.invoice)} will be notified and can view it. Once sent, the amounts can no longer be changed.`
                    : pending.invoice.status === 'draft'
                      ? 'The draft will be marked cancelled. This cannot be undone.'
                      : `${buyerName(pending.invoice)} will see it as cancelled. This cannot be undone.`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1 border border-border-cream bg-card-hover p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-dark-secondary">Buyer</span>
                  <span>{buyerName(pending.invoice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dark-secondary">Total</span>
                  <span className="font-semibold">
                    {formatPrice(invoiceTotalPkr(pending.invoice), 'PKR')}
                  </span>
                </div>
                {pending.kind === 'send' && (
                  <div className="flex justify-between">
                    <span className="text-text-dark-secondary">Due</span>
                    <span>
                      {pending.invoice.due_date
                        ? new Date(pending.invoice.due_date).toLocaleDateString()
                        : '30 days after sending'}
                    </span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  className={OUTLINE}
                  disabled={!!busyId}
                  onClick={() => setPending(null)}
                >
                  Keep it
                </Button>
                <Button
                  variant={pending.kind === 'send' ? 'default' : 'destructive'}
                  disabled={!!busyId}
                  onClick={() =>
                    pending.kind === 'send' ? send(pending.invoice) : cancel(pending.invoice)
                  }
                >
                  {busyId
                    ? pending.kind === 'send'
                      ? 'Sending…'
                      : 'Cancelling…'
                    : pending.kind === 'send'
                      ? 'Send invoice'
                      : 'Cancel invoice'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-3xl border-border-cream bg-card text-text-dark">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="text-text-dark">
                  Invoice #{viewing.id.slice(0, 8).toUpperCase()}
                </DialogTitle>
                <DialogDescription className="text-text-dark-secondary">
                  {buyerName(viewing)} · {INVOICE_STATUS_LABELS[viewing.status]} ·{' '}
                  {formatPrice(viewing.amount_paid_pkr, 'PKR')} paid of{' '}
                  {formatPrice(invoiceTotalPkr(viewing), 'PKR')}
                </DialogDescription>
              </DialogHeader>
              <InvoicePreview
                {...pdfPropsFor(viewing)}
                className="h-[70vh] w-full overflow-hidden border border-border-cream"
              />
              <DialogFooter>
                <Button
                  variant="outline"
                  className={OUTLINE}
                  disabled={busyId === viewing.id}
                  onClick={() => download(viewing)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const OUTLINE = 'border-border-cream text-text-dark'
