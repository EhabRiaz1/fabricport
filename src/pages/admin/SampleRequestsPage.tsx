import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { AdminPageHeader } from '@/pages/admin/components/AdminPageHeader'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from '@/pages/admin/components/AdminTable'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SAMPLE_REQUEST_SELECT, SAMPLE_STATUS_LABELS, formatShipTo, normalizeSampleRequest } from '@/lib/samples'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { SampleRequestWithRelations } from '@/types/app'
import type { SampleRequestStatus } from '@/types/database.types'

const TONE: Record<string, string> = {
  requested: 'text-warning',
  approved: 'text-accent',
  shipped: 'text-accent',
  delivered: 'text-success',
  declined: 'text-danger',
  cancelled: 'text-text-muted',
}

const FILTERS = ['all', 'requested', 'approved', 'shipped', 'delivered'] as const

/**
 * Read-only oversight, matching the admin Inquiries console. Admins can already
 * SEE every sample request via the party-read policy (it includes is_admin), but
 * fulfilment stays with the supplier — an admin marking someone else's parcel
 * shipped would be inventing facts.
 */
export default function AdminSampleRequestsPage() {
  const [rows, setRows] = useState<SampleRequestWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sample_requests')
      .select(SAMPLE_REQUEST_SELECT)
      .order('created_at', { ascending: false })
    setRows((data ?? []).map((r) => normalizeSampleRequest(r as Record<string, unknown>)))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  )

  const waiting = rows.filter((r) => r.status === 'requested').length

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
        title="Sample Requests"
        description={
          waiting > 0
            ? `${waiting} request${waiting === 1 ? '' : 's'} still waiting on a supplier.`
            : 'Swatch requests across the marketplace. Read-only.'
        }
      />

      <div className="mb-4 flex items-center border border-border">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
              filter === f ? 'bg-ink text-background' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto px-3 font-mono text-[10px] uppercase tracking-widest text-text-secondary">
          {visible.length} of {rows.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="mx-auto h-10 w-10 text-text-muted" />
            <p className="mt-4 text-text-dark-secondary">
              {rows.length === 0 ? 'No sample requests yet.' : 'None match this filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <AdminTable>
          <AdminTableHead>
            <AdminTableHeaderCell>Fabric</AdminTableHeaderCell>
            <AdminTableHeaderCell>Buyer</AdminTableHeaderCell>
            <AdminTableHeaderCell>Supplier</AdminTableHeaderCell>
            <AdminTableHeaderCell>Ship to</AdminTableHeaderCell>
            <AdminTableHeaderCell>Tracking</AdminTableHeaderCell>
            <AdminTableHeaderCell>Requested</AdminTableHeaderCell>
            <AdminTableHeaderCell>Status</AdminTableHeaderCell>
          </AdminTableHead>
          <AdminTableBody>
            {visible.map((r) => {
              const product = r.items?.[0]?.product
              return (
                <AdminTableRow key={r.id}>
                  <AdminTableCell className="font-medium">
                    {product ? (
                      <Link to={`/fabric/${product.slug}`} className="hover:text-accent">
                        {product.title}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </AdminTableCell>
                  <AdminTableCell>
                    {r.buyer?.company_name ?? r.buyer?.full_name ?? '—'}
                  </AdminTableCell>
                  <AdminTableCell>{r.supplier?.brand_name ?? '—'}</AdminTableCell>
                  <AdminTableCell className="max-w-[220px] truncate text-text-dark-secondary">
                    {formatShipTo(r.ship_to)}
                  </AdminTableCell>
                  <AdminTableCell className="font-mono text-xs">
                    {r.tracking_number ? `${r.courier ?? ''} ${r.tracking_number}`.trim() : '—'}
                  </AdminTableCell>
                  <AdminTableCell className="text-text-dark-secondary">
                    {new Date(r.created_at).toLocaleDateString()}
                  </AdminTableCell>
                  <AdminTableCell>
                    <span
                      className={cn(
                        'font-mono text-[10px] uppercase tracking-widest',
                        TONE[r.status] ?? 'text-text-muted',
                      )}
                    >
                      {SAMPLE_STATUS_LABELS[r.status as SampleRequestStatus]}
                    </span>
                  </AdminTableCell>
                </AdminTableRow>
              )
            })}
          </AdminTableBody>
        </AdminTable>
      )}
    </div>
  )
}
