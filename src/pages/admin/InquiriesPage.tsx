import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { InquiryStatus } from '@/types/database.types'
import { AdminPageHeader } from './components/AdminPageHeader'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from './components/AdminTable'

const STATUS_VARIANT: Record<InquiryStatus, 'success' | 'warning' | 'status' | 'default' | 'danger'> = {
  open: 'warning',
  responded: 'status',
  negotiating: 'status',
  closed: 'success',
  archived: 'default',
}

interface InquiryRow {
  id: string
  status: InquiryStatus
  created_at: string
  updated_at: string
  buyer?: { profile?: { full_name: string | null; company_name: string | null } }
  supplier?: { brand_name: string }
  fabrics: string[]
}

const STATUS_FILTERS: Array<InquiryStatus | 'all'> = [
  'all',
  'open',
  'responded',
  'negotiating',
  'closed',
  'archived',
]

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | 'all'>('all')

  const loadInquiries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('inquiries')
      .select(`
        id, status, created_at, updated_at,
        buyer:buyers(profile:profiles(full_name, company_name)),
        supplier:suppliers(brand_name),
        items:inquiry_items(product:products(title))
      `)
      .order('updated_at', { ascending: false })

    setLoadError(error?.message ?? null)
    if (!error) {
      setInquiries(
        (data ?? []).map((row) => {
          const buyer = Array.isArray(row.buyer) ? row.buyer[0] : row.buyer
          const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier
          const profile = buyer?.profile
            ? Array.isArray(buyer.profile)
              ? buyer.profile[0]
              : buyer.profile
            : undefined
          const items = (Array.isArray(row.items) ? row.items : []) as Array<{
            product: { title: string } | { title: string }[] | null
          }>
          const fabrics = items
            .map((it) => (Array.isArray(it.product) ? it.product[0]?.title : it.product?.title))
            .filter((t): t is string => Boolean(t))
          return {
            id: row.id,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            buyer: profile ? { profile } : undefined,
            supplier: supplier ?? undefined,
            fabrics,
          }
        }),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadInquiries()
  }, [loadInquiries])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inquiries.filter((inq) => {
      if (statusFilter !== 'all' && inq.status !== statusFilter) return false
      if (!q) return true
      const haystack = [
        inq.buyer?.profile?.full_name,
        inq.buyer?.profile?.company_name,
        inq.supplier?.brand_name,
        ...inq.fabrics,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [inquiries, search, statusFilter])

  return (
    <div>
      <AdminPageHeader
        title="Inquiries"
        description="Read-only view of all buyer–supplier conversations."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            type="search"
            placeholder="Search buyer, supplier, fabric…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-surface pl-9 text-text-primary"
          />
        </div>
        <div className="flex flex-wrap border border-border bg-surface">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                statusFilter === s
                  ? 'bg-ink text-[#F5EDE4]'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-48 w-full bg-border-cream" />
            </div>
          ) : loadError ? (
            <p role="alert" className="p-6 text-sm text-danger">
              Could not load inquiries: {loadError}
            </p>
          ) : inquiries.length === 0 ? (
            <p className="p-6 text-sm text-text-dark-secondary">No inquiries yet.</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-text-dark-secondary">No inquiries match these filters.</p>
          ) : (
            <AdminTable>
              <AdminTableHead>
                <AdminTableHeaderCell>Buyer</AdminTableHeaderCell>
                <AdminTableHeaderCell>Supplier</AdminTableHeaderCell>
                <AdminTableHeaderCell>Fabrics</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                <AdminTableHeaderCell>Created</AdminTableHeaderCell>
                <AdminTableHeaderCell>Updated</AdminTableHeaderCell>
                <AdminTableHeaderCell className="text-right">View</AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {filtered.map((inquiry) => (
                  <AdminTableRow key={inquiry.id}>
                    <AdminTableCell>
                      <p className="font-medium">
                        {inquiry.buyer?.profile?.full_name ?? '—'}
                      </p>
                      <p className="text-xs text-text-dark-secondary">
                        {inquiry.buyer?.profile?.company_name ?? ''}
                      </p>
                    </AdminTableCell>
                    <AdminTableCell>{inquiry.supplier?.brand_name ?? '—'}</AdminTableCell>
                    <AdminTableCell className="max-w-[240px] text-xs text-text-dark-secondary">
                      {inquiry.fabrics.length === 0
                        ? '—'
                        : inquiry.fabrics.slice(0, 2).join(', ') +
                          (inquiry.fabrics.length > 2 ? ` +${inquiry.fabrics.length - 2}` : '')}
                    </AdminTableCell>
                    <AdminTableCell>
                      <Badge variant={STATUS_VARIANT[inquiry.status]}>{inquiry.status}</Badge>
                    </AdminTableCell>
                    <AdminTableCell className="text-text-dark-secondary">
                      {new Date(inquiry.created_at).toLocaleDateString()}
                    </AdminTableCell>
                    <AdminTableCell className="text-text-dark-secondary">
                      {new Date(inquiry.updated_at).toLocaleDateString()}
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/admin/inquiries/${inquiry.id}`}>Open</Link>
                      </Button>
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminTable>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
