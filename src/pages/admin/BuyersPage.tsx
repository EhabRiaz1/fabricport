import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database.types'
import { AdminPageHeader } from './components/AdminPageHeader'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from './components/AdminTable'

interface BuyerRow {
  id: string
  email_domain: string | null
  created_at: string
  profile: Profile | null
}

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<BuyerRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadBuyers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('buyers')
      .select('id, email_domain, created_at, profile:profiles(*)')
      .order('created_at', { ascending: false })

    if (!error) {
      setBuyers(
        (data ?? []).map((row) => ({
          ...row,
          profile: Array.isArray(row.profile) ? row.profile[0] : row.profile,
        })) as BuyerRow[],
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadBuyers()
  }, [loadBuyers])

  return (
    <div>
      <AdminPageHeader
        title="Buyers"
        description="Registered buyer accounts on the platform."
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-48 w-full bg-border-cream" />
            </div>
          ) : buyers.length === 0 ? (
            <p className="p-6 text-sm text-text-dark-secondary">No buyers registered.</p>
          ) : (
            <AdminTable>
              <AdminTableHead>
                <AdminTableHeaderCell>Name</AdminTableHeaderCell>
                <AdminTableHeaderCell>Company</AdminTableHeaderCell>
                <AdminTableHeaderCell>Email Domain</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                <AdminTableHeaderCell>Joined</AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {buyers.map((buyer) => (
                  <AdminTableRow key={buyer.id}>
                    <AdminTableCell className="font-medium">
                      {buyer.profile?.full_name ?? '—'}
                    </AdminTableCell>
                    <AdminTableCell>{buyer.profile?.company_name ?? '—'}</AdminTableCell>
                    <AdminTableCell className="font-mono text-xs">
                      {buyer.email_domain ?? '—'}
                    </AdminTableCell>
                    <AdminTableCell>{buyer.profile?.status ?? '—'}</AdminTableCell>
                    <AdminTableCell className="text-text-dark-secondary">
                      {new Date(buyer.created_at).toLocaleDateString()}
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
