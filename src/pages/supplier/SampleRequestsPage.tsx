import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCounterparties } from '@/hooks/useCounterparties'
import { useProfile } from '@/hooks/useProfile'
import { SAMPLE_REQUEST_SELECT, SAMPLE_STATUS_LABELS, normalizeSampleRequest } from '@/lib/samples'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { SampleRequestWithRelations } from '@/types/app'

const TONE: Record<string, string> = {
  requested: 'text-warning',
  approved: 'text-accent',
  shipped: 'text-accent',
  delivered: 'text-success',
  declined: 'text-danger',
  cancelled: 'text-text-dark-secondary',
}

export default function SupplierSampleRequestsPage() {
  const { profile } = useProfile()
  const { nameOf } = useCounterparties()
  const [requests, setRequests] = useState<SampleRequestWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const profileId = profile?.id

  const load = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const { data } = await supabase
      .from('sample_requests')
      .select(SAMPLE_REQUEST_SELECT)
      .eq('supplier_id', profileId)
      .order('created_at', { ascending: false })

    setRequests((data ?? []).map((row) => normalizeSampleRequest(row as Record<string, unknown>)))
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

  const pending = requests.filter((r) => r.status === 'requested').length

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Orders</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Sample Requests
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {pending > 0
            ? `${pending} request${pending === 1 ? '' : 's'} waiting on you.`
            : 'Swatch requests from buyers.'}
        </p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="mx-auto h-10 w-10 text-text-muted" />
            <p className="mt-4 text-text-dark-secondary">No sample requests yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const product = request.items?.[0]?.product
            return (
              <Link
                key={request.id}
                to={`/supplier-portal/samples/${request.id}`}
                className="block border border-border-cream bg-card p-4 transition-colors hover:border-ink/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-dark">
                      {product?.title ?? 'Fabric sample'}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                      {/* RLS hides the buyer's profile from suppliers — see
                          useCounterparties. */}
                      {nameOf(request.buyer_id, 'Buyer')} ·{' '}
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-widest',
                      TONE[request.status] ?? 'text-text-dark-secondary',
                    )}
                  >
                    {SAMPLE_STATUS_LABELS[request.status]}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
