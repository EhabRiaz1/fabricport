import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, Mail, Package, PlusCircle, ScanLine, Truck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { FabricCategory, ListingRequest } from '@/types/database.types'

const SAMPLE_ADDRESS = ['FabricPort Studio — Sample Intake', 'Karachi, Pakistan']

const WORKFLOW_STEPS = [
  { key: 'submitted', label: 'Submitted', icon: Mail },
  { key: 'fabric_received', label: 'Sample received', icon: Package },
  { key: 'scanning', label: 'Scanning', icon: ScanLine },
  { key: 'complete', label: 'Listed', icon: Check },
] as const

interface FabricDetails {
  category_id?: string
  color_name?: string
  rough_specs?: Record<string, string | number>
  notes?: string
  courier?: string
  tracking_number?: string
}

function stepIndex(status: string): number {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === status)
  return idx === -1 ? 0 : idx
}

function StatusStepper({ status }: { status: string }) {
  if (status === 'rejected') {
    return (
      <div className="flex items-center gap-2 text-danger">
        <X className="h-4 w-4" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Rejected</span>
      </div>
    )
  }

  const current = stepIndex(status)
  return (
    <div className="flex items-center gap-0">
      {WORKFLOW_STEPS.map((step, index) => {
        const done = index <= current
        const Icon = step.icon
        return (
          <div key={step.key} className="flex items-center">
            {index > 0 && (
              <div
                className={cn(
                  'h-px w-6 sm:w-10',
                  index <= current ? 'bg-accent' : 'bg-border-cream',
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1.5 px-1">
              <span
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border',
                  done
                    ? 'border-accent bg-accent text-white'
                    : 'border-border-cream bg-card text-text-dark-secondary',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span
                className={cn(
                  'hidden font-mono text-[8px] uppercase tracking-[0.12em] sm:block',
                  done ? 'text-text-dark' : 'text-text-dark-secondary',
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ListingRequestPage() {
  const { profile } = useProfile()
  const [requests, setRequests] = useState<ListingRequest[]>([])
  const [categories, setCategories] = useState<FabricCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [categoryId, setCategoryId] = useState('')
  const [colorName, setColorName] = useState('')
  const [gsm, setGsm] = useState('')
  const [composition, setComposition] = useState('')
  const [width, setWidth] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [trackingDrafts, setTrackingDrafts] = useState<
    Record<string, { courier: string; tracking: string }>
  >({})

  const profileId = profile?.id

  const loadRequests = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const [requestsRes, categoriesRes] = await Promise.all([
      supabase
        .from('listing_requests')
        .select('*')
        .eq('supplier_id', profileId)
        .order('created_at', { ascending: false }),
      supabase.from('fabric_categories').select('*').order('name'),
    ])
    setRequests((requestsRes.data ?? []) as ListingRequest[])
    setCategories(categoriesRes.data ?? [])
    setLoading(false)
  }, [profileId])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!profile?.id) return

    if (!colorName.trim() || !categoryId) {
      toast.error('Missing details', 'Category and color name are required.')
      return
    }

    setSubmitting(true)

    const roughSpecs: Record<string, string | number> = {}
    if (gsm) roughSpecs.gsm = Number(gsm)
    if (composition) roughSpecs.composition = composition
    if (width) roughSpecs.width = width

    const { error: insertError } = await supabase.from('listing_requests').insert({
      supplier_id: profile.id,
      status: 'submitted',
      supplier_notes: notes.trim() || null,
      fabric_details: {
        category_id: categoryId,
        color_name: colorName.trim(),
        rough_specs: Object.keys(roughSpecs).length > 0 ? roughSpecs : undefined,
        notes: notes.trim() || undefined,
      },
    })

    if (insertError) {
      toast.error('Submission failed', insertError.message)
    } else {
      toast.success(
        'Listing request submitted',
        'Now mail your fabric sample — see the instructions on the request card.',
      )
      setShowForm(false)
      setCategoryId('')
      setColorName('')
      setGsm('')
      setComposition('')
      setWidth('')
      setNotes('')
      await loadRequests()
    }
    setSubmitting(false)
  }

  async function saveTracking(request: ListingRequest) {
    const draft = trackingDrafts[request.id]
    if (!draft?.tracking.trim()) return

    const details = ((request.fabric_details ?? {}) as FabricDetails) || {}
    const { error } = await supabase
      .from('listing_requests')
      .update({
        fabric_details: {
          ...details,
          courier: draft.courier.trim() || undefined,
          tracking_number: draft.tracking.trim(),
        },
      })
      .eq('id', request.id)

    if (error) {
      toast.error('Could not save tracking', error.message)
    } else {
      toast.success('Tracking saved', 'Our team will watch for your parcel.')
      await loadRequests()
    }
  }

  function categoryName(details: FabricDetails): string {
    const cat = categories.find((c) => c.id === details.category_id)
    return cat?.name ?? 'Fabric'
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
            Listing Requests
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Get a fabric listed
          </h1>
          <p className="mt-1 max-w-lg text-sm text-text-secondary">
            Submit the details, mail us a sample, and our studio scans and lists
            it on the marketplace for you.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <PlusCircle className="h-4 w-4" />
          {showForm ? 'Close form' : 'New listing request'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-text-dark">Fabric Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-text-dark">Category *</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger className="border-border-cream bg-card-hover text-text-dark">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="colorName" className="text-text-dark">
                    Color Name *
                  </Label>
                  <Input
                    id="colorName"
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    required
                    placeholder="e.g. Midnight Navy"
                    className="border-border-cream bg-card-hover text-text-dark"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="gsm" className="text-text-dark">
                    GSM
                  </Label>
                  <Input
                    id="gsm"
                    type="number"
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value)}
                    placeholder="180"
                    className="border-border-cream bg-card-hover text-text-dark"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width" className="text-text-dark">
                    Width
                  </Label>
                  <Input
                    id="width"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="58 inches"
                    className="border-border-cream bg-card-hover text-text-dark"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="composition" className="text-text-dark">
                    Composition
                  </Label>
                  <Input
                    id="composition"
                    value={composition}
                    onChange={(e) => setComposition(e.target.value)}
                    placeholder="100% Cotton"
                    className="border-border-cream bg-card-hover text-text-dark"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-text-dark">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Stock available, certifications, anything our team should know"
                  className="border-border-cream bg-card-hover text-text-dark"
                />
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Listing Request'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {requests.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ScanLine className="mx-auto h-10 w-10 text-text-muted" />
            <p className="mt-4 text-text-dark-secondary">
              No listing requests yet. Start one to get your fabric scanned and listed.
            </p>
          </CardContent>
        </Card>
      ) : (
        requests.map((request) => {
          const details = (request.fabric_details ?? {}) as FabricDetails
          const needsSample = request.status === 'submitted'
          const hasTracking = Boolean(details.tracking_number)
          return (
            <Card key={request.id}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-text-dark">
                    {details.color_name ?? 'Fabric'} · {categoryName(details)}
                  </CardTitle>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dark-secondary">
                    Ref {request.id.slice(0, 8).toUpperCase()} ·{' '}
                    {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusStepper status={request.status} />
              </CardHeader>
              <CardContent className="space-y-4">
                {details.rough_specs && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(details.rough_specs).map(([key, value]) => (
                      <span
                        key={key}
                        className="border border-border-cream bg-card-hover px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-text-dark-secondary"
                      >
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}

                {request.status === 'rejected' && request.rejection_reason && (
                  <p className="border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                    {request.rejection_reason}
                  </p>
                )}

                {request.admin_notes && request.status !== 'rejected' && (
                  <p className="border border-border-cream bg-card-hover px-4 py-3 text-sm text-text-dark-secondary">
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-accent">
                      From our team —{' '}
                    </span>
                    {request.admin_notes}
                  </p>
                )}

                {needsSample && (
                  <div className="border border-accent/25 bg-accent/5 p-4">
                    <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
                      <Truck className="h-3.5 w-3.5" />
                      Next step — mail your sample
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-text-dark">
                      Send at least a 1×1 meter swatch to{' '}
                      <span className="font-medium">{SAMPLE_ADDRESS.join(', ')}</span>. Write{' '}
                      <span className="font-mono text-xs font-semibold">
                        REF {request.id.slice(0, 8).toUpperCase()}
                      </span>{' '}
                      on the parcel so our intake team can match it instantly.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
                      <Input
                        placeholder="Courier (TCS, Leopards…)"
                        value={trackingDrafts[request.id]?.courier ?? details.courier ?? ''}
                        onChange={(e) =>
                          setTrackingDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              courier: e.target.value,
                              tracking: prev[request.id]?.tracking ?? details.tracking_number ?? '',
                            },
                          }))
                        }
                        className="border-border-cream bg-card text-text-dark"
                      />
                      <Input
                        placeholder="Tracking number"
                        value={trackingDrafts[request.id]?.tracking ?? details.tracking_number ?? ''}
                        onChange={(e) =>
                          setTrackingDrafts((prev) => ({
                            ...prev,
                            [request.id]: {
                              courier: prev[request.id]?.courier ?? details.courier ?? '',
                              tracking: e.target.value,
                            },
                          }))
                        }
                        className="border-border-cream bg-card text-text-dark"
                      />
                      <Button variant="outline" onClick={() => saveTracking(request)}>
                        {hasTracking ? 'Update tracking' : 'Save tracking'}
                      </Button>
                    </div>
                    {hasTracking && (
                      <p className="mt-2 font-mono text-[10px] text-text-dark-secondary">
                        Tracking on file: {details.courier ? `${details.courier} · ` : ''}
                        {details.tracking_number}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
