import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Mail, Package, ScanLine, Truck, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { dispatchNotification } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { ListingRequest, ListingRequestStatus } from '@/types/database.types'
import { AdminPageHeader } from './components/AdminPageHeader'

const COLUMNS: { status: ListingRequestStatus; label: string; icon: typeof Mail }[] = [
  { status: 'submitted', label: 'Submitted', icon: Mail },
  { status: 'fabric_received', label: 'Sample received', icon: Package },
  { status: 'scanning', label: 'Scanning', icon: ScanLine },
  { status: 'complete', label: 'Listed', icon: Check },
]

const NEXT_STATUS: Partial<Record<ListingRequestStatus, ListingRequestStatus>> = {
  submitted: 'fabric_received',
  fabric_received: 'scanning',
  scanning: 'complete',
}

const PREV_STATUS: Partial<Record<ListingRequestStatus, ListingRequestStatus>> = {
  fabric_received: 'submitted',
  scanning: 'fabric_received',
  complete: 'scanning',
}

interface FabricDetails {
  category_id?: string
  color_name?: string
  rough_specs?: Record<string, string | number>
  courier?: string
  tracking_number?: string
}

interface ListingRequestRow extends ListingRequest {
  supplier?: { brand_name: string; slug: string }
  product?: { title: string; slug: string } | null
}

export default function ListingPipelinePage() {
  const [requests, setRequests] = useState<ListingRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ListingRequestRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('listing_requests')
      .select('*, supplier:suppliers(brand_name, slug), product:products(title, slug)')
      .order('created_at', { ascending: false })

    if (!error) setRequests((data ?? []) as ListingRequestRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  async function updateStatus(
    request: ListingRequestRow,
    status: ListingRequestStatus,
    extra?: { rejection_reason?: string },
  ) {
    setUpdating(request.id)
    const { error } = await supabase
      .from('listing_requests')
      .update({ status, ...extra, updated_at: new Date().toISOString() })
      .eq('id', request.id)

    if (error) {
      toast.error('Update failed', error.message)
    } else {
      setRequests((prev) =>
        prev.map((r) => (r.id === request.id ? { ...r, status, ...extra } : r)),
      )

      const details = (request.fabric_details ?? {}) as FabricDetails
      const fabricName = details.color_name ?? 'Your fabric'
      const statusCopy: Partial<Record<ListingRequestStatus, string>> = {
        fabric_received: `${fabricName}: sample received — scanning is next.`,
        scanning: `${fabricName} is being scanned by our studio.`,
        complete: `${fabricName} is live on the marketplace.`,
        rejected: `${fabricName}: request was declined.${extra?.rejection_reason ? ` Reason: ${extra.rejection_reason}` : ''}`,
      }
      const body = statusCopy[status]
      if (body) {
        dispatchNotification({
          userId: request.supplier_id,
          type: 'listing_update',
          title: 'Listing request update',
          body,
          data: { listing_request_id: request.id },
        }).catch(() => undefined)
      }
    }
    setUpdating(null)
  }

  const byStatus = useMemo(() => {
    const map = new Map<ListingRequestStatus, ListingRequestRow[]>()
    for (const column of COLUMNS) map.set(column.status, [])
    const rejected: ListingRequestRow[] = []
    for (const request of requests) {
      if (request.status === 'rejected') {
        rejected.push(request)
      } else {
        map.get(request.status)?.push(request)
      }
    }
    return { map, rejected }
  }, [requests])

  if (loading) {
    return (
      <div>
        <AdminPageHeader
          title="Listing Pipeline"
          description="Track every fabric sample from submission to a live listing."
        />
        <div className="grid gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full bg-border-cream" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="Listing Pipeline"
        description="Track every fabric sample from submission to a live listing."
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {COLUMNS.map(({ status, label, icon: Icon }) => {
          const items = byStatus.map.get(status) ?? []
          return (
            <div key={status} className="flex flex-col border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-dark">
                  <Icon className="h-3.5 w-3.5 text-accent" />
                  {label}
                </span>
                <span className="flex h-5 min-w-5 items-center justify-center bg-elevated px-1.5 font-mono text-[10px] text-text-dark-secondary">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 p-3">
                {items.length === 0 ? (
                  <p className="py-6 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-text-muted">
                    Empty
                  </p>
                ) : (
                  items.map((request) => {
                    const details = (request.fabric_details ?? {}) as FabricDetails
                    const next = NEXT_STATUS[request.status]
                    const prev = PREV_STATUS[request.status]
                    return (
                      <div
                        key={request.id}
                        className={cn(
                          'border border-border-cream bg-card-hover p-3',
                          updating === request.id && 'opacity-60',
                        )}
                      >
                        <p className="text-sm font-medium text-text-dark">
                          {details.color_name ?? request.product?.title ?? 'Fabric'}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-text-dark-secondary">
                          {request.supplier?.brand_name ?? 'Supplier'} · REF{' '}
                          {request.id.slice(0, 8).toUpperCase()}
                        </p>

                        {details.rough_specs && (
                          <p className="mt-2 line-clamp-2 text-xs text-text-dark-secondary">
                            {Object.entries(details.rough_specs)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' · ')}
                          </p>
                        )}

                        {details.tracking_number && (
                          <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-bronze">
                            <Truck className="h-3 w-3" />
                            {details.courier ? `${details.courier} · ` : ''}
                            {details.tracking_number}
                          </p>
                        )}

                        {request.product && (
                          <Link
                            to={`/fabric/${request.product.slug}`}
                            className="mt-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-accent hover:underline"
                          >
                            View listing →
                          </Link>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-cream pt-2">
                          <div className="flex gap-1">
                            {prev && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title={`Back to ${prev.replace('_', ' ')}`}
                                disabled={updating === request.id}
                                onClick={() => updateStatus(request, prev)}
                                className="h-7 w-7 text-text-dark-secondary"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {request.status === 'submitted' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reject request"
                                disabled={updating === request.id}
                                onClick={() => {
                                  setRejectTarget(request)
                                  setRejectReason('')
                                }}
                                className="h-7 w-7 text-danger"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                          {next && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updating === request.id}
                              onClick={() => updateStatus(request, next)}
                              className="h-7 gap-1 px-2 font-mono text-[10px] uppercase tracking-[0.1em]"
                            >
                              {next.replace('_', ' ')}
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {byStatus.rejected.length > 0 && (
        <div className="mt-8 border border-danger/25 bg-danger/5 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-danger">
            Rejected ({byStatus.rejected.length})
          </p>
          <ul className="mt-3 space-y-2">
            {byStatus.rejected.map((request) => {
              const details = (request.fabric_details ?? {}) as FabricDetails
              return (
                <li
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-border-cream bg-card px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm text-text-dark">
                      {details.color_name ?? 'Fabric'} —{' '}
                      {request.supplier?.brand_name ?? 'Supplier'}
                    </p>
                    {request.rejection_reason && (
                      <p className="text-xs text-text-dark-secondary">
                        {request.rejection_reason}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => updateStatus(request, 'submitted', { rejection_reason: '' })}
                  >
                    Reopen
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject listing request</DialogTitle>
            <DialogDescription>
              The supplier sees this reason on their listing request card.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Fabric category not currently accepted, sample quality issue…"
            className="min-h-[90px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={async () => {
                if (!rejectTarget) return
                await updateStatus(rejectTarget, 'rejected', {
                  rejection_reason: rejectReason.trim(),
                })
                setRejectTarget(null)
                toast.success('Request rejected', 'The supplier has been informed.')
              }}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
