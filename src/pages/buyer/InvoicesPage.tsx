import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge'
import { useProfile } from '@/hooks/useProfile'
import { INVOICE_SELECT, isOverdue, normalizeInvoice, outstandingPkr } from '@/lib/invoices'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import type { InvoiceWithRelations } from '@/types/app'

export default function BuyerInvoicesPage() {
  const { profile } = useProfile()
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const profileId = profile?.id

  const load = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select(INVOICE_SELECT)
      .eq('buyer_id', profileId)
      // A draft invoice has not been issued to the buyer yet — showing one would
      // leak a supplier's work in progress.
      .neq('status', 'draft')
      .order('created_at', { ascending: false })

    setInvoices((data ?? []).map((r) => normalizeInvoice(r as Record<string, unknown>)))
    setLoading(false)
  }, [profileId])

  useEffect(() => {
    load()
  }, [load])

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
          Invoices issued to you by suppliers, and what's still outstanding.
        </p>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-text-muted" />
            <p className="mt-4 text-text-dark-secondary">No invoices yet.</p>
            <p className="mt-1 text-sm text-text-dark-secondary">
              Suppliers issue an invoice once you've agreed terms on an inquiry.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const overdue = isOverdue(invoice)
            const outstanding = outstandingPkr(invoice)
            return (
              <Link
                key={invoice.id}
                to={`/buyer/invoices/${invoice.id}`}
                className="block border border-border-cream bg-card p-4 transition-colors hover:border-ink/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-dark">
                      {invoice.supplier?.brand_name ?? 'Supplier'}
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
                      {outstanding > 0 && (
                        <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                          {formatPrice(outstanding, 'PKR')} outstanding
                        </p>
                      )}
                    </div>
                    <PaymentStatusBadge status={invoice.payment_status} overdue={overdue} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
