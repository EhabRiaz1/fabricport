import { useCallback, useEffect, useState } from 'react'
import { Ban, Flag, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { Profile, ProfileStatus } from '@/types/database.types'
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
  const [busy, setBusy] = useState<string | null>(null)

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

  /**
   * Routed through the `admin-users` edge function, NOT a direct profiles update.
   * SuppliersPage writes profiles.status directly, which leaves the auth user
   * un-banned and their existing session refreshable — set_status also sets
   * ban_duration, so a suspended buyer is actually locked out.
   */
  async function setStatus(buyer: BuyerRow, status: ProfileStatus) {
    setBusy(buyer.id)
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'set_status', userId: buyer.id, status },
    })
    setBusy(null)

    if (error || data?.ok === false) {
      toast.error('Could not update account', error?.message ?? data?.error)
      return
    }
    toast.success(status === 'suspended' ? 'Buyer suspended' : 'Buyer reactivated')
    await loadBuyers()
  }

  async function toggleFlag(buyer: BuyerRow) {
    const next = !buyer.profile?.overdue_flagged
    setBusy(buyer.id)
    const { error } = await supabase
      .from('profiles')
      .update({
        overdue_flagged: next,
        overdue_flagged_at: next ? new Date().toISOString() : null,
      })
      .eq('id', buyer.id)
    setBusy(null)

    if (error) {
      toast.error('Could not update flag', error.message)
      return
    }
    toast.success(next ? 'Buyer flagged' : 'Flag cleared')
    await loadBuyers()
  }

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
                <AdminTableHeaderCell>Actions</AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {buyers.map((buyer) => {
                  const suspended = buyer.profile?.status === 'suspended'
                  return (
                  <AdminTableRow key={buyer.id}>
                    <AdminTableCell className="font-medium">
                      {buyer.profile?.full_name ?? '—'}
                    </AdminTableCell>
                    <AdminTableCell>{buyer.profile?.company_name ?? '—'}</AdminTableCell>
                    <AdminTableCell className="font-mono text-xs">
                      {buyer.email_domain ?? '—'}
                    </AdminTableCell>
                    <AdminTableCell>
                      <span className={cn(suspended && 'text-danger')}>
                        {buyer.profile?.status ?? '—'}
                      </span>
                      {buyer.profile?.overdue_flagged && (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-warning">
                          overdue
                        </span>
                      )}
                    </AdminTableCell>
                    <AdminTableCell className="text-text-dark-secondary">
                      {new Date(buyer.created_at).toLocaleDateString()}
                    </AdminTableCell>
                    <AdminTableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === buyer.id}
                          onClick={() => toggleFlag(buyer)}
                        >
                          <Flag className="h-3.5 w-3.5" />
                          {buyer.profile?.overdue_flagged ? 'Clear' : 'Flag'}
                        </Button>
                        <Button
                          size="sm"
                          variant={suspended ? 'outline' : 'destructive'}
                          disabled={busy === buyer.id}
                          onClick={() => setStatus(buyer, suspended ? 'active' : 'suspended')}
                        >
                          {suspended ? (
                            <>
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Reactivate
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5" />
                              Suspend
                            </>
                          )}
                        </Button>
                      </div>
                    </AdminTableCell>
                  </AdminTableRow>
                  )
                })}
              </AdminTableBody>
            </AdminTable>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
