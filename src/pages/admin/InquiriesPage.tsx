import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
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
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<InquiryRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadInquiries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('inquiries')
      .select(`
        id, status, created_at, updated_at,
        buyer:buyers(profile:profiles(full_name, company_name)),
        supplier:suppliers(brand_name)
      `)
      .order('updated_at', { ascending: false })

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
          return {
            id: row.id,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            buyer: profile ? { profile } : undefined,
            supplier: supplier ?? undefined,
          }
        }),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadInquiries()
  }, [loadInquiries])

  return (
    <div>
      <AdminPageHeader
        title="Inquiries"
        description="Read-only view of all buyer–supplier conversations."
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-48 w-full bg-border-cream" />
            </div>
          ) : inquiries.length === 0 ? (
            <p className="p-6 text-sm text-text-dark-secondary">No inquiries yet.</p>
          ) : (
            <AdminTable>
              <AdminTableHead>
                <AdminTableHeaderCell>Buyer</AdminTableHeaderCell>
                <AdminTableHeaderCell>Supplier</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                <AdminTableHeaderCell>Created</AdminTableHeaderCell>
                <AdminTableHeaderCell>Updated</AdminTableHeaderCell>
                <AdminTableHeaderCell className="text-right">View</AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {inquiries.map((inquiry) => (
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
