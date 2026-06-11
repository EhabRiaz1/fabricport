import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ChatThread } from '@/components/chat/ChatThread'
import { InquirySummary } from '@/components/shared/InquirySummary'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/hooks/useProfile'
import { INQUIRY_BASE_SELECT, INQUIRY_ITEMS_SELECT, normalizeInquiry } from '@/lib/inquiries'
import { supabase } from '@/lib/supabase'
import type { InquiryWithRelations } from '@/types/app'

const INQUIRY_SELECT = `${INQUIRY_BASE_SELECT}, ${INQUIRY_ITEMS_SELECT}`

export default function BuyerInquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useProfile()
  const [inquiry, setInquiry] = useState<InquiryWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !profile?.id) return

    const inquiryId = id

    async function load() {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('inquiries')
        .select(INQUIRY_SELECT)
        .eq('id', inquiryId)
        .eq('buyer_id', profile!.id)
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
        <Link to="/buyer/inquiries" className="mt-4 inline-block text-accent hover:underline">
          Back to inquiries
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        to="/buyer/inquiries"
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to inquiries
      </Link>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <InquirySummary inquiry={inquiry} viewerRole="buyer" />
        <div className="overflow-hidden border border-border-cream">
          <ChatThread
            inquiryId={inquiry.id}
            currentUserId={profile.id}
            notifyUserId={inquiry.supplier_id}
            notifyFromLabel={profile.company_name ?? profile.full_name ?? 'a buyer'}
          />
        </div>
      </div>
    </div>
  )
}
