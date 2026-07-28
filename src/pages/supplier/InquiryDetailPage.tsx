import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ChatThread } from '@/components/chat/ChatThread'
import { InquirySummary } from '@/components/shared/InquirySummary'
import { InquiryStatusControl } from '@/components/shared/InquiryStatusControl'
import { StatusTimeline } from '@/components/shared/StatusTimeline'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/hooks/useProfile'
import { INQUIRY_BASE_SELECT, INQUIRY_ITEMS_SELECT, normalizeInquiry } from '@/lib/inquiries'
import { supabase } from '@/lib/supabase'
import type { InquiryWithRelations } from '@/types/app'

const INQUIRY_SELECT = `${INQUIRY_BASE_SELECT}, ${INQUIRY_ITEMS_SELECT}`

export default function SupplierInquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useProfile()
  const [inquiry, setInquiry] = useState<InquiryWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timelineKey, setTimelineKey] = useState(0)

  useEffect(() => {
    if (!id || !profile?.id) return

    const inquiryId = id

    async function load() {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('inquiries')
        .select(INQUIRY_SELECT)
        .eq('id', inquiryId)
        .eq('supplier_id', profile!.id)
        .maybeSingle()

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Inquiry not found')
        setInquiry(null)
      } else {
        setInquiry(normalizeInquiry(data as Record<string, unknown>))
      }
      setLoading(false)
    }

    load()
  }, [id, profile?.id])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error || !inquiry || !profile) {
    return (
      <div className="text-center">
        <p className="text-text-secondary">{error ?? 'Inquiry not found'}</p>
        <Link
          to="/supplier-portal/inquiries"
          className="mt-4 inline-block text-accent hover:underline"
        >
          Back to inquiries
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/supplier-portal/inquiries"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to inquiries
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <InquiryStatusControl
            inquiryId={inquiry.id}
            status={inquiry.status}
            viewerRole="supplier"
            onChanged={(next) => {
              setInquiry((current) => (current ? { ...current, status: next } : current))
              setTimelineKey((key) => key + 1)
            }}
          />
          <Button asChild variant="outline" size="sm">
            <Link to={`/supplier-portal/invoices/new?inquiry=${inquiry.id}`}>
              Create Invoice
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <InquirySummary inquiry={inquiry} viewerRole="supplier" />
          <StatusTimeline inquiryId={inquiry.id} refreshKey={timelineKey} />
        </div>
        <div className="overflow-hidden border border-border-cream">
          <ChatThread
            inquiryId={inquiry.id}
            currentUserId={profile.id}
            notifyUserId={inquiry.buyer_id}
            notifyFromLabel={profile.company_name ?? profile.full_name ?? 'your supplier'}
          />
        </div>
      </div>
    </div>
  )
}
