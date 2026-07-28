import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ChatThread } from '@/components/chat/ChatThread'
import { SampleStepper } from '@/components/samples/SampleStepper'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/hooks/useProfile'
import {
  SAMPLE_REQUEST_SELECT,
  SAMPLE_STATUS_LABELS,
  SUPPLIER_SAMPLE_TRANSITIONS,
  formatShipTo,
  normalizeSampleRequest,
} from '@/lib/samples'
import { dispatchNotification } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'
import type { SampleRequestWithRelations } from '@/types/app'
import type { SampleRequestStatus } from '@/types/database.types'

export default function SupplierSampleRequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useProfile()
  const [request, setRequest] = useState<SampleRequestWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [courier, setCourier] = useState('')
  const [tracking, setTracking] = useState('')

  const profileId = profile?.id

  const load = useCallback(async () => {
    if (!id || !profileId) return
    setLoading(true)
    const { data } = await supabase
      .from('sample_requests')
      .select(SAMPLE_REQUEST_SELECT)
      .eq('id', id)
      .eq('supplier_id', profileId)
      .maybeSingle()

    if (data) {
      const normalized = normalizeSampleRequest(data as Record<string, unknown>)
      setRequest(normalized)
      setCourier(normalized.courier ?? '')
      setTracking(normalized.tracking_number ?? '')
    } else {
      setRequest(null)
    }
    setLoading(false)
  }, [id, profileId])

  useEffect(() => {
    load()
  }, [load])

  async function advance(next: SampleRequestStatus) {
    if (!request) return

    // Shipping without a tracking number leaves the buyer with a stepper that
    // says "shipped" and nothing to act on.
    if (next === 'shipped' && !tracking.trim()) {
      toast.error('Tracking number required', 'Add a tracking number before marking it shipped.')
      return
    }

    setSaving(true)
    const patch =
      next === 'shipped'
        ? {
            status: next,
            courier: courier.trim() || null,
            tracking_number: tracking.trim(),
          }
        : { status: next }

    const { error } = await supabase.from('sample_requests').update(patch).eq('id', request.id)
    setSaving(false)

    if (error) {
      toast.error('Could not update', error.message)
      return
    }

    dispatchNotification({
      userId: request.buyer_id,
      type: 'sample_status_changed',
      title: `Sample ${SAMPLE_STATUS_LABELS[next].toLowerCase()}`,
      body: `Your sample request is now ${SAMPLE_STATUS_LABELS[next].toLowerCase()}.`,
      data: { sample_request_id: request.id },
    }).catch(() => undefined)

    toast.success(`Marked ${SAMPLE_STATUS_LABELS[next].toLowerCase()}`)
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
        <Link
          to="/supplier-portal/samples"
          className="mt-4 inline-block text-accent hover:underline"
        >
          Back to sample requests
        </Link>
      </div>
    )
  }

  const product = request.items?.[0]?.product
  const nextStates = SUPPLIER_SAMPLE_TRANSITIONS[request.status] ?? []

  return (
    <div className="space-y-6">
      <Link
        to="/supplier-portal/samples"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sample requests
      </Link>

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
                  Post to
                </p>
                <p className="mt-1 text-sm text-text-dark">{formatShipTo(request.ship_to)}</p>
              </div>

              {request.buyer_notes && (
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                    Buyer's note
                  </p>
                  <p className="mt-1 text-sm text-text-dark">{request.buyer_notes}</p>
                </div>
              )}

              {request.status === 'approved' && (
                <div className="space-y-2 border-t border-border-cream pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                    Dispatch details
                  </p>
                  <Input
                    placeholder="Courier (e.g. TCS)"
                    value={courier}
                    disabled={saving}
                    onChange={(e) => setCourier(e.target.value)}
                  />
                  <Input
                    placeholder="Tracking number *"
                    value={tracking}
                    disabled={saving}
                    onChange={(e) => setTracking(e.target.value)}
                  />
                </div>
              )}

              {nextStates.length > 0 && (
                <div className="flex flex-wrap gap-2 border-t border-border-cream pt-3">
                  {nextStates.map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant={next === 'declined' ? 'outline' : 'default'}
                      disabled={saving}
                      onClick={() => advance(next)}
                    >
                      {next === 'declined' ? 'Decline' : `Mark ${SAMPLE_STATUS_LABELS[next]}`}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="overflow-hidden border border-border-cream">
          <ChatThread
            sampleRequestId={request.id}
            currentUserId={profile.id}
            notifyUserId={request.buyer_id}
            notifyFromLabel={profile.company_name ?? profile.full_name ?? 'your supplier'}
          />
        </div>
      </div>
    </div>
  )
}
