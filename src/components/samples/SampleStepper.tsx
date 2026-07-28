import { Check, Truck, X } from 'lucide-react'
import { SAMPLE_STATUS_LABELS, SAMPLE_STEPS } from '@/lib/samples'
import { cn } from '@/lib/utils'
import type { SampleRequestStatus } from '@/types/database.types'

export interface SampleStepperProps {
  status: SampleRequestStatus
  courier?: string | null
  trackingNumber?: string | null
  className?: string
}

/**
 * Samples get the full stepper (inquiries get a collapsed history disclosure
 * instead) because fulfilment is genuinely linear and the buyer's question is
 * "where is my swatch", which a position on a track answers directly.
 *
 * `declined` and `cancelled` are terminal side-exits, not steps, so they replace
 * the track rather than sitting on it.
 */
export function SampleStepper({
  status,
  courier,
  trackingNumber,
  className,
}: SampleStepperProps) {
  if (status === 'declined' || status === 'cancelled') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 border border-border-cream bg-card-hover p-3',
          className,
        )}
      >
        <X className="h-4 w-4 shrink-0 text-danger" />
        <p className="text-sm text-text-dark">
          {status === 'declined'
            ? 'The supplier declined this sample request.'
            : 'You cancelled this sample request.'}
        </p>
      </div>
    )
  }

  const activeIndex = SAMPLE_STEPS.indexOf(status)

  return (
    <div className={cn('space-y-3', className)}>
      <ol className="flex items-center">
        {SAMPLE_STEPS.map((step, index) => {
          const done = index < activeIndex
          const current = index === activeIndex
          const last = index === SAMPLE_STEPS.length - 1

          return (
            <li key={step} className={cn('flex items-center', !last && 'flex-1')}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center border text-[10px] font-semibold transition-colors',
                    done && 'border-accent bg-accent text-white',
                    current && 'border-accent text-accent',
                    !done && !current && 'border-border-cream text-text-dark-secondary',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.16em]',
                    current ? 'text-accent' : 'text-text-dark-secondary',
                  )}
                >
                  {SAMPLE_STATUS_LABELS[step]}
                </span>
              </div>
              {!last && (
                <span
                  aria-hidden
                  className={cn(
                    'mx-2 mb-5 h-px flex-1 transition-colors',
                    index < activeIndex ? 'bg-accent' : 'bg-border-cream',
                  )}
                />
              )}
            </li>
          )
        })}
      </ol>

      {/* Tracking appears exactly when it becomes meaningful. */}
      {trackingNumber && (status === 'shipped' || status === 'delivered') && (
        <div className="flex items-center gap-2 border border-border-cream bg-card-hover p-3">
          <Truck className="h-4 w-4 shrink-0 text-text-dark-secondary" />
          <p className="text-sm text-text-dark">
            {courier ? `${courier} · ` : ''}
            <span className="font-mono">{trackingNumber}</span>
          </p>
        </div>
      )}
    </div>
  )
}

export default SampleStepper
