import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ChatThread } from '@/components/chat/ChatThread'
import { SampleStepper } from '@/components/samples/SampleStepper'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/hooks/useProfile'
import { SAMPLE_REQUEST_SELECT, formatShipTo, normalizeSampleRequest } from '@/lib/samples'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'
import type { SampleRequestWithRelations } from '@/types/app'

export default function BuyerSampleRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useProfile()
  const [request, setRequest] = useState<SampleRequestWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  const profileId = profile?.id

  const load = useCallback(async () => {
    if (!id || !profileId) return
    setLoading(true)
    const { data } = await supabase
      .from('sample_requests')
      .select(SAMPLE_REQUEST_SELECT)
      .eq('id', id)
      .eq('buyer_id', profileId)
      .maybeSingle()

    setRequest(data ? normalizeSampleRequest(data as Record<string, unknown>) : null)
    setLoading(false)
  }, [id, profileId])

  useEffect(() => {
    load()
  }, [load])

  async function handleCancel() {
    if (!request) return
    setCancelling(true)
    const { error } = await supabase
      .from('sample_requests')
      .update({ status: 'cancelled' })
      .eq('id', request.id)
    setCancelling(false)

    if (error) {
      toast.error('Could not cancel', error.message)
      return
    }
    toast.success('Sample request cancelled')
    await load()
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!request || !profile) {
    return (
      <div className="text-center">
        <p className="text-text-secondary">Sample request not found</p>
        <Link to="/buyer/samples" className="mt-4 inline-block text-accent hover:underline">
          Back to sample requests
        </Link>
      </div>
    )
  }

  const product = request.items?.[0]?.product
  // The buyer may only cancel, and only while it is still cancellable —
  // mirrors guard_sample_request_columns.
  const canCancel = request.status === 'requested' || request.status === 'approved'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/buyer/samples"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sample requests
        </Link>
        {canCancel && (
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling…' : 'Cancel request'}
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-text-dark">
                {product?.title ?? 'Fabric sample'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SampleStepper
                status={request.status}
                courier={request.courier}
                trackingNumber={request.tracking_number}
              />

              <div className="border-t border-border-cream pt-3">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                  Supplier
                </p>
                <p className="mt-1 text-sm text-text-dark">
                  {request.supplier?.brand_name ?? '—'}
                </p>
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                  Delivering to
                </p>
                {/* The snapshot taken when the request was sent, not the current
                    address book entry. */}
                <p className="mt-1 text-sm text-text-dark">{formatShipTo(request.ship_to)}</p>
              </div>

              {request.buyer_notes && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                    Your note
                  </p>
                  <p className="mt-1 text-sm text-text-dark">{request.buyer_notes}</p>
                </div>
              )}

              {product && (
                <Link
                  to={`/fabric/${product.slug}`}
                  className="inline-block text-sm text-accent hover:underline"
                >
                  View fabric →
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="overflow-hidden border border-border-cream">
          <ChatThread
            sampleRequestId={request.id}
            currentUserId={profile.id}
            notifyUserId={request.supplier_id}
            notifyFromLabel={profile.company_name ?? profile.full_name ?? 'a buyer'}
          />
        </div>
      </div>
    </div>
  )
}
