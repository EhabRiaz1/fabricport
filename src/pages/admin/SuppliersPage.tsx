import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Ban } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, VerifiedBadge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import type { SupplierWithProfile } from '@/types/app'
import type { ProfileStatus } from '@/types/database.types'
import { AdminPageHeader } from './components/AdminPageHeader'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from './components/AdminTable'

const STATUS_VARIANT: Record<ProfileStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('suppliers')
      .select('*, profile:profiles(*)')
      .order('brand_name')

    if (!error) setSuppliers((data ?? []) as SupplierWithProfile[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  async function toggleVerified(supplier: SupplierWithProfile) {
    setUpdating(supplier.id)
    const { error } = await supabase
      .from('suppliers')
      .update({ is_verified: !supplier.is_verified })
      .eq('id', supplier.id)

    if (!error) {
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === supplier.id ? { ...s, is_verified: !s.is_verified } : s,
        ),
      )
    }
    setUpdating(null)
  }

  async function toggleSuspend(supplier: SupplierWithProfile) {
    const currentStatus = supplier.profile?.status ?? 'active'
    const nextStatus: ProfileStatus = currentStatus === 'suspended' ? 'active' : 'suspended'
    setUpdating(supplier.id)

    const { error } = await supabase
      .from('profiles')
      .update({ status: nextStatus })
      .eq('id', supplier.id)

    if (!error) {
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === supplier.id && s.profile
            ? { ...s, profile: { ...s.profile, status: nextStatus } }
            : s,
        ),
      )
    }
    setUpdating(null)
  }

  return (
    <div>
      <AdminPageHeader
        title="Suppliers"
        description="Verify suppliers and manage account status."
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-48 w-full bg-border-cream" />
            </div>
          ) : suppliers.length === 0 ? (
            <p className="p-6 text-sm text-text-dark-secondary">No suppliers registered.</p>
          ) : (
            <AdminTable>
              <AdminTableHead>
                <AdminTableHeaderCell>Brand</AdminTableHeaderCell>
                <AdminTableHeaderCell>Contact</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                <AdminTableHeaderCell>Verified</AdminTableHeaderCell>
                <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {suppliers.map((supplier) => {
                  const status = supplier.profile?.status ?? 'pending'
                  return (
                    <AdminTableRow key={supplier.id}>
                      <AdminTableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{supplier.brand_name}</p>
                            {supplier.is_verified && <VerifiedBadge />}
                          </div>
                          <Link
                            to={`/supplier/${supplier.slug}`}
                            className="font-mono text-[10px] text-accent hover:underline"
                          >
                            /{supplier.slug}
                          </Link>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>
                        <p className="text-sm">{supplier.profile?.full_name ?? '—'}</p>
                        <p className="text-xs text-text-dark-secondary">
                          {supplier.profile?.company_name ?? '—'}
                        </p>
                      </AdminTableCell>
                      <AdminTableCell>
                        <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
                      </AdminTableCell>
                      <AdminTableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updating === supplier.id}
                          onClick={() => toggleVerified(supplier)}
                          className={supplier.is_verified ? 'text-accent' : 'text-text-dark-secondary'}
                        >
                          <BadgeCheck className="h-4 w-4" />
                          {supplier.is_verified ? 'Verified' : 'Unverified'}
                        </Button>
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updating === supplier.id}
                          onClick={() => toggleSuspend(supplier)}
                        >
                          <Ban className="h-4 w-4" />
                          {status === 'suspended' ? 'Reinstate' : 'Suspend'}
                        </Button>
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
