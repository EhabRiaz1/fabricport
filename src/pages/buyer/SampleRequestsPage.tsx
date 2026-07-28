import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/hooks/useProfile'
import { SAMPLE_STATUS_LABELS, SAMPLE_REQUEST_SELECT, normalizeSampleRequest } from '@/lib/samples'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { SampleRequestWithRelations } from '@/types/app'

const ACTIVE_TONE: Record<string, string> = {
  requested: 'text-warning',
  approved: 'text-accent',
  shipped: 'text-accent',
  delivered: 'text-success',
  declined: 'text-danger',
  cancelled: 'text-text-dark-secondary',
}

export default function BuyerSampleRequestsPage() {
  const { profile } = useProfile()
  const [requests, setRequests] = useState<SampleRequestWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const profileId = profile?.id

  const load = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const { data } = await supabase
      .from('sample_requests')
      .select(SAMPLE_REQUEST_SELECT)
      .eq('buyer_id', profileId)
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

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Orders</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Sample Requests
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Physical swatches you've asked suppliers to post to you.
        </p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Package className="mx-auto h-10 w-10 text-text-muted" />
            <p className="mt-4 text-text-dark-secondary">
              You haven't requested any samples yet.
            </p>
            <p className="mt-1 text-sm text-text-dark-secondary">
              Open a fabric and choose "Request a sample" to get a swatch in the post.
            </p>
            <Button asChild className="mt-5" variant="outline">
              <Link to="/marketplace">Browse Marketplace</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const product = request.items?.[0]?.product
            return (
              <Link
                key={request.id}
                to={`/buyer/samples/${request.id}`}
                className="block border border-border-cream bg-card p-4 transition-colors hover:border-ink/30"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-dark">
                      {product?.title ?? 'Fabric sample'}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                      {request.supplier?.brand_name ?? 'Supplier'} ·{' '}
                      {new Date(request.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-widest',
                      ACTIVE_TONE[request.status] ?? 'text-text-dark-secondary',
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
