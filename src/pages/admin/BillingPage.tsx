import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, FileText, Plus, Trash2 } from 'lucide-react'
import { AdminPageHeader } from '@/pages/admin/components/AdminPageHeader'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from '@/pages/admin/components/AdminTable'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge'
import {
  INVOICE_SELECT,
  PAYMENT_METHODS,
  deletePayment,
  isOverdue,
  normalizeInvoice,
  outstandingPkr,
  recordPayment,
} from '@/lib/invoices'
import { dispatchNotification } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { formatPrice, cn } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { InvoiceWithRelations } from '@/types/app'
import type { PaymentMethod } from '@/types/database.types'

type Tab = 'invoices' | 'payments'

/**
 * Invoices and Payments are one admin object, not two pages — you never reason
 * about a payment without the invoice it settles. Hence one "Billing" nav entry
 * with a tab strip, matching the console pattern in admin MessagesPage.
 */
export default function AdminBillingPage() {
  const [tab, setTab] = useState<Tab>('invoices')
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [target, setTarget] = useState<InvoiceWithRelations | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer')
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select(INVOICE_SELECT)
      .order('created_at', { ascending: false })
    setInvoices((data ?? []).map((r) => normalizeInvoice(r as Record<string, unknown>)))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const allPayments = useMemo(
    () =>
      invoices
        .flatMap((invoice) => (invoice.payments ?? []).map((p) => ({ payment: p, invoice })))
        .sort((a, b) => b.payment.paid_on.localeCompare(a.payment.paid_on)),
    [invoices],
  )

  const totals = useMemo(() => {
    const live = invoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled')
    return {
      outstanding: live.reduce((sum, i) => sum + outstandingPkr(i), 0),
      overdue: live.filter(isOverdue).reduce((sum, i) => sum + outstandingPkr(i), 0),
      collected: live.reduce((sum, i) => sum + i.amount_paid_pkr, 0),
    }
  }, [invoices])

  function openRecord(invoice: InvoiceWithRelations) {
    setTarget(invoice)
    // Pre-fill the balance — the common case is settling in full.
    setAmount(String(outstandingPkr(invoice) || ''))
    setMethod('bank_transfer')
    setReference('')
  }

  async function handleRecord() {
    if (!target) return
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    setSaving(true)
    try {
      await recordPayment({
        invoiceId: target.id,
        amountPkr: value,
        method,
        reference,
      })
      dispatchNotification({
        userId: target.buyer_id,
        type: 'payment_recorded',
        title: 'Payment recorded',
        body: `${formatPrice(value, 'PKR')} has been recorded against your invoice.`,
        data: { invoice_id: target.id },
      }).catch(() => undefined)

      setTarget(null)
      await load()
      toast.success('Payment recorded')
    } catch (err) {
      toast.error('Could not record payment', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(paymentId: string) {
    try {
      await deletePayment(paymentId)
      await load()
      toast.success('Payment removed', 'Invoice totals recalculated.')
    } catch (err) {
      toast.error('Could not remove payment', err instanceof Error ? err.message : undefined)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="Billing"
        description="Invoices issued across the marketplace and the payments recorded against them."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Outstanding" value={formatPrice(totals.outstanding, 'PKR')} />
        <Stat label="Overdue" value={formatPrice(totals.overdue, 'PKR')} tone="danger" />
        <Stat label="Collected" value={formatPrice(totals.collected, 'PKR')} tone="success" />
      </div>

      <div className="mb-4 flex border border-border">
        {(
          [
            ['invoices', 'Invoices', FileText],
            ['payments', 'Payments', Banknote],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors',
              tab === key
                ? 'bg-ink text-[#F5EDE4]'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'invoices' ? (
        invoices.length === 0 ? (
          <Empty message="No invoices have been issued yet." />
        ) : (
          <AdminTable>
            <AdminTableHead>
              <AdminTableHeaderCell>Supplier</AdminTableHeaderCell>
              <AdminTableHeaderCell>Buyer</AdminTableHeaderCell>
              <AdminTableHeaderCell>Total</AdminTableHeaderCell>
              <AdminTableHeaderCell>Paid</AdminTableHeaderCell>
              <AdminTableHeaderCell>Outstanding</AdminTableHeaderCell>
              <AdminTableHeaderCell>Due</AdminTableHeaderCell>
              <AdminTableHeaderCell>Status</AdminTableHeaderCell>
              <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
            </AdminTableHead>
            <AdminTableBody>
              {invoices.map((invoice) => (
                <AdminTableRow key={invoice.id}>
                  <AdminTableCell>{invoice.supplier?.brand_name ?? '—'}</AdminTableCell>
                  <AdminTableCell>
                    {invoice.buyer?.company_name ?? invoice.buyer?.full_name ?? '—'}
                  </AdminTableCell>
                  <AdminTableCell>{formatPrice(invoice.subtotal_pkr ?? 0, 'PKR')}</AdminTableCell>
                  <AdminTableCell>{formatPrice(invoice.amount_paid_pkr, 'PKR')}</AdminTableCell>
                  <AdminTableCell>{formatPrice(outstandingPkr(invoice), 'PKR')}</AdminTableCell>
                  <AdminTableCell>
                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
                  </AdminTableCell>
                  <AdminTableCell>
                    <div className="flex items-center gap-1.5">
                      <PaymentStatusBadge
                        status={invoice.payment_status}
                        overdue={isOverdue(invoice)}
                      />
                      {invoice.status === 'draft' && (
                        <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                          draft
                        </span>
                      )}
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    {/* A draft has not been issued and has no due date, so there is
                        nothing to settle against it yet. */}
                    {invoice.status === 'draft' || invoice.payment_status === 'paid' ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => openRecord(invoice)}>
                        <Plus className="h-3.5 w-3.5" />
                        Record
                      </Button>
                    )}
                  </AdminTableCell>
                </AdminTableRow>
              ))}
            </AdminTableBody>
          </AdminTable>
        )
      ) : allPayments.length === 0 ? (
        <Empty message="No payments recorded yet." />
      ) : (
        <AdminTable>
          <AdminTableHead>
            <AdminTableHeaderCell>Paid on</AdminTableHeaderCell>
            <AdminTableHeaderCell>Amount</AdminTableHeaderCell>
            <AdminTableHeaderCell>Buyer</AdminTableHeaderCell>
            <AdminTableHeaderCell>Supplier</AdminTableHeaderCell>
            <AdminTableHeaderCell>Method</AdminTableHeaderCell>
            <AdminTableHeaderCell>Reference</AdminTableHeaderCell>
            <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
          </AdminTableHead>
          <AdminTableBody>
            {allPayments.map(({ payment, invoice }) => (
              <AdminTableRow key={payment.id}>
                <AdminTableCell>{new Date(payment.paid_on).toLocaleDateString()}</AdminTableCell>
                <AdminTableCell>{formatPrice(payment.amount_pkr, 'PKR')}</AdminTableCell>
                <AdminTableCell>
                  {invoice.buyer?.company_name ?? invoice.buyer?.full_name ?? '—'}
                </AdminTableCell>
                <AdminTableCell>{invoice.supplier?.brand_name ?? '—'}</AdminTableCell>
                <AdminTableCell>{payment.method?.replace('_', ' ') ?? '—'}</AdminTableCell>
                <AdminTableCell>{payment.reference ?? '—'}</AdminTableCell>
                <AdminTableCell>
                  <button
                    type="button"
                    title="Remove payment"
                    onClick={() => handleDelete(payment.id)}
                    className="p-1.5 text-text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {target && (
                <>
                  {formatPrice(outstandingPkr(target), 'PKR')} outstanding on{' '}
                  {target.supplier?.brand_name ?? 'this invoice'}. Invoice totals recalculate
                  automatically.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Amount (PKR)
              </label>
              <Input
                type="number"
                min={1}
                step="0.01"
                value={amount}
                disabled={saving}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Method
              </label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as PaymentMethod)}
                disabled={saving}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Reference (optional)
              </label>
              <Input
                value={reference}
                disabled={saving}
                placeholder="Transfer ref, cheque number…"
                onChange={(e) => setReference(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRecord} disabled={saving}>
              {saving ? 'Recording…' : 'Record payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'danger' | 'success'
}) {
  return (
    <div className="border border-border bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-lg font-semibold',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
          !tone && 'text-text-primary',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <p className="text-text-dark-secondary">{message}</p>
      </CardContent>
    </Card>
  )
}
