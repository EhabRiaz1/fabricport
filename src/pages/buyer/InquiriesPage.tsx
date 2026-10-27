import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { InquiryStatusBadge } from '@/components/shared/InquiryStatusBadge'
import { useProfile } from '@/hooks/useProfile'
import {
  fetchInquiryListRows,
  formatMeters,
  messagePreview,
  relativeStamp,
  summarizeTitles,
  type InquiryListRow,
} from '@/lib/inquiry-list'
import { toast } from '@/stores/toast'
import type { InquiryStatus } from '@/types/database.types'

export default function BuyerInquiriesPage() {
  const { profile } = useProfile()
  const [inquiries, setInquiries] = useState<InquiryListRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return

    async function load() {
      setLoading(true)
      try {
        setInquiries(await fetchInquiryListRows())
      } catch (err) {
        setInquiries([])
        toast.error('Could not load inquiries', err instanceof Error ? err.message : undefined)
      }
      setLoading(false)
    }

    load()
  }, [profile?.id])

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Inquiries</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Your Inquiries
        </h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-text-dark-secondary">
            No inquiries yet. Add fabrics to your cart to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => {
            const mine = inq.last_message_sender === profile?.id
            return (
              <Link key={inq.id} to={`/buyer/inquiries/${inq.id}`}>
                <Card className="transition-transform hover:scale-[1.005]">
                  <CardContent className="flex items-start justify-between gap-4 p-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <p className="font-medium text-text-dark">
                          {inq.supplier_name ?? 'Supplier'}
                        </p>
                        <p className="font-mono text-[10px] text-text-dark-secondary">
                          {summarizeTitles(inq.item_titles)} · {formatMeters(inq.total_meters)}
                        </p>
                      </div>
                      {inq.last_message ? (
                        <p
                          className={`mt-1 truncate text-sm ${
                            inq.unread_count > 0 && !mine
                              ? 'font-medium text-text-dark'
                              : 'text-text-dark-secondary'
                          }`}
                        >
                          {mine ? 'You: ' : ''}
                          {messagePreview(inq.last_message)}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-text-dark-secondary">No messages yet</p>
                      )}
                      <p className="mt-1 font-mono text-[10px] text-text-dark-secondary">
                        {relativeStamp(inq.last_message_at ?? inq.updated_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <InquiryStatusBadge status={inq.status as InquiryStatus} />
                      {inq.unread_count > 0 && (
                        <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                          {inq.unread_count} new
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
