import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Flag, Info } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { formatPrice, cn } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { AdminReportStats } from '@/types/database.types'

interface OverdueBuyer {
  buyer_id: string
  full_name: string | null
  company_name: string | null
  overdue_flagged: boolean
  status: string
  overdue_invoices: number
  overdue_amount_pkr: number
  oldest_due_date: string | null
}

export default function AdminReportsPage() {
  const [stats, setStats] = useState<AdminReportStats | null>(null)
  const [overdue, setOverdue] = useState<OverdueBuyer[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [statsRes, overdueRes] = await Promise.all([
      supabase.rpc('get_admin_report_stats', { p_weeks: 8 }),
      supabase.rpc('get_overdue_buyers'),
    ])
    if (statsRes.error) toast.error('Could not load reports', statsRes.error.message)
    setStats((statsRes.data as AdminReportStats) ?? null)
    setOverdue((overdueRes.data as OverdueBuyer[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleFlag(buyer: OverdueBuyer) {
    setBusy(buyer.buyer_id)
    const next = !buyer.overdue_flagged
    const { error } = await supabase
      .from('profiles')
      .update({
        overdue_flagged: next,
        overdue_flagged_at: next ? new Date().toISOString() : null,
      })
      .eq('id', buyer.buyer_id)
    setBusy(null)

    if (error) {
      toast.error('Could not update flag', error.message)
      return
    }
    toast.success(next ? 'Buyer flagged' : 'Flag cleared')
    await load()
  }

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const f = stats.funnel
  const conv = stats.buyer_conversion
  const maxWeek = Math.max(1, ...stats.inquiries_per_week.map((w) => w.count))

  return (
    <div>
      <AdminPageHeader
        title="Reports"
        description="Marketplace activity over the last 8 weeks."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Supplier response rate"
          value={
            stats.supplier_response_rate == null
              ? '—'
              : `${stats.supplier_response_rate}%`
          }
          hint={
            stats.median_first_response_hours == null
              ? 'No replies yet'
              : `median first reply ${stats.median_first_response_hours}h`
          }
        />
        <Stat
          label="Buyer conversion"
          value={
            conv.buyers_total === 0
              ? '—'
              : `${Math.round((conv.buyers_with_inquiry / conv.buyers_total) * 100)}%`
          }
          hint={`${conv.buyers_with_inquiry} of ${conv.buyers_total} buyers inquired`}
        />
        <Stat
          label="Outstanding"
          value={formatPrice(stats.outstanding_amount_pkr, 'PKR')}
          hint={`${formatPrice(stats.collected_amount_pkr, 'PKR')} collected`}
        />
        <Stat
          label="Overdue"
          value={formatPrice(stats.overdue_amount_pkr, 'PKR')}
          tone={stats.overdue_amount_pkr > 0 ? 'danger' : undefined}
          hint={`${overdue.length} buyer${overdue.length === 1 ? '' : 's'}`}
        />
      </div>

      {/* Channel funnel */}
      <Card className="mb-6">
        <CardContent className="py-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
            Channel funnel
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FunnelStep label="Product views" value={f.product_views} />
            <FunnelStep label="Unique sessions" value={f.unique_view_sessions} />
            <FunnelStep
              label="Inquiries"
              value={f.inquiries}
              rate={f.unique_view_sessions ? f.inquiries / f.unique_view_sessions : null}
            />
            <FunnelStep
              label="Sample requests"
              value={f.sample_requests}
              rate={f.unique_view_sessions ? f.sample_requests / f.unique_view_sessions : null}
            />
            <FunnelStep
              label="Supplier replies"
              value={f.supplier_responses}
              rate={f.inquiries ? f.supplier_responses / f.inquiries : null}
            />
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-text-dark-secondary">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              There is no off-platform contact button in the app, so there are no
              click-throughs to measure — every inquiry starts and stays in-app.{' '}
              {f.whatsapp_notifications_sent} WhatsApp notification
              {f.whatsapp_notifications_sent === 1 ? '' : 's'} were sent out in this period.
            </span>
          </p>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="py-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              Inquiries per week
            </p>
            {stats.inquiries_per_week.length === 0 ? (
              <p className="mt-4 text-sm text-text-dark-secondary">No inquiries yet.</p>
            ) : (
              // h-full on the column below is load-bearing: without a definite
              // parent height the bar's percentage height resolves to zero and the
              // chart renders blank. min-h keeps a 1-count week visible.
              <div className="mt-4 flex h-32 gap-2">
                {stats.inquiries_per_week.map((w) => (
                  <div
                    key={w.week}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                  >
                    <div
                      className="w-full min-h-[3px] bg-accent/70"
                      style={{ height: `${(w.count / maxWeek) * 100}%` }}
                      title={`${w.count} inquir${w.count === 1 ? 'y' : 'ies'} week of ${w.week}`}
                    />
                    <span className="font-mono text-[8px] text-text-dark-secondary">
                      {w.week.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              Most inquired fabrics
            </p>
            {stats.top_fabrics.length === 0 ? (
              <p className="mt-4 text-sm text-text-dark-secondary">No data yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {stats.top_fabrics.map((fab) => (
                  <li key={fab.slug} className="flex items-center justify-between text-sm">
                    <Link
                      to={`/fabric/${fab.slug}`}
                      className="text-text-dark hover:text-accent"
                    >
                      {fab.title}
                    </Link>
                    <span className="font-mono text-xs text-text-dark-secondary">
                      {fab.inquiries}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              Most inquired suppliers
            </p>
            {stats.top_suppliers.length === 0 ? (
              <p className="mt-3 text-sm text-text-dark-secondary">No data yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {stats.top_suppliers.map((sup) => (
                  <li
                    key={sup.brand_name}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-text-dark">{sup.brand_name}</span>
                    <span className="font-mono text-xs text-text-dark-secondary">
                      {sup.inquiries}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-danger" />
        <h2 className="font-display text-lg font-semibold text-text-primary">
          Overdue accounts
        </h2>
      </div>

      {overdue.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-text-dark-secondary">Nothing overdue. </p>
          </CardContent>
        </Card>
      ) : (
        <AdminTable>
          <AdminTableHead>
            <AdminTableHeaderCell>Buyer</AdminTableHeaderCell>
            <AdminTableHeaderCell>Overdue invoices</AdminTableHeaderCell>
            <AdminTableHeaderCell>Amount</AdminTableHeaderCell>
            <AdminTableHeaderCell>Oldest due</AdminTableHeaderCell>
            <AdminTableHeaderCell>Account</AdminTableHeaderCell>
            <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
          </AdminTableHead>
          <AdminTableBody>
            {overdue.map((b) => (
              <AdminTableRow key={b.buyer_id}>
                <AdminTableCell>{b.company_name ?? b.full_name ?? '—'}</AdminTableCell>
                <AdminTableCell>{b.overdue_invoices}</AdminTableCell>
                <AdminTableCell>{formatPrice(b.overdue_amount_pkr, 'PKR')}</AdminTableCell>
                <AdminTableCell>
                  {b.oldest_due_date ? new Date(b.oldest_due_date).toLocaleDateString() : '—'}
                </AdminTableCell>
                <AdminTableCell>
                  <span
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-widest',
                      b.status === 'suspended' ? 'text-danger' : 'text-text-muted',
                    )}
                  >
                    {b.status}
                    {b.overdue_flagged && ' · flagged'}
                  </span>
                </AdminTableCell>
                <AdminTableCell>
                  {/* Soft action only. Hard deactivation stays on the Buyers page,
                      where it routes through admin-users set_status and also bans
                      the auth user. */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === b.buyer_id}
                    onClick={() => toggleFlag(b)}
                  >
                    <Flag className="h-3.5 w-3.5" />
                    {b.overdue_flagged ? 'Clear flag' : 'Flag'}
                  </Button>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'danger'
}) {
  return (
    <div className="border border-border bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-lg font-semibold',
          tone === 'danger' ? 'text-danger' : 'text-text-primary',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
    </div>
  )
}

function FunnelStep({
  label,
  value,
  rate,
}: {
  label: string
  value: number
  rate?: number | null
}) {
  return (
    <div className="border border-border-cream p-3">
      <p className="font-mono text-[9px] uppercase tracking-widest text-text-dark-secondary">
        {label}
      </p>
      <p className="mt-1 font-display text-base font-semibold text-text-dark">{value}</p>
      {rate != null && (
        <p className="text-[10px] text-text-dark-secondary">
          {(rate * 100).toFixed(1)}% of previous
        </p>
      )}
    </div>
  )
}
