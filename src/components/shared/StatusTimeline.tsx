import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { InquiryStatusEvent } from '@/types/database.types'

export interface StatusTimelineProps {
  inquiryId: string
  /** Bump this to refetch after a status change made elsewhere on the page. */
  refreshKey?: number
  className?: string
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Inquiry status history as a collapsed disclosure.
 *
 * Deliberately understated: for inquiries the useful signal is "what is it now"
 * plus "when did it last move", so the current badge and relative time stay
 * visible and the full history is one click away. The full stepper treatment
 * belongs to sample requests, which have a genuinely linear fulfilment path.
 */
export function StatusTimeline({ inquiryId, refreshKey = 0, className }: StatusTimelineProps) {
  const [events, setEvents] = useState<InquiryStatusEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('inquiry_status_events')
        .select('*')
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: false })

      if (!cancelled) {
        setEvents((data ?? []) as InquiryStatusEvent[])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [inquiryId, refreshKey])

  if (loading || events.length === 0) return null

  const latest = events[0]

  return (
    <div className={cn('border-t border-border-cream pt-3', className)}>
      <div className="flex items-center justify-between gap-3">
        {/* No badge here on purpose — InquirySummary already renders the current
            status right above this. Repeating it put the same word on screen
            three times next to the status <Select>. This row owns "when". */}
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
          Updated {formatWhen(latest.created_at)}
        </span>
        {events.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary transition-colors hover:text-accent"
          >
            History
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {open && events.length > 1 && (
        <ol className="mt-3 space-y-2 border-l border-border-cream pl-3">
          {events.map((event) => (
            <li key={event.id} className="text-xs text-text-dark-secondary">
              <span className="text-text-dark">
                {event.from_status ? `${event.from_status} → ${event.to_status}` : 'Created'}
              </span>
              <span className="ml-2 font-mono text-[10px] uppercase tracking-widest">
                {formatWhen(event.created_at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default StatusTimeline
