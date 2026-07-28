import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TestReportStatus } from '@/types/database.types'

export interface TestReportBadgeProps {
  status: TestReportStatus | null
  /** Compact chip for dense surfaces like the admin table. */
  compact?: boolean
  className?: string
}

/**
 * Independent lab test outcome.
 *
 * Renders nothing when the status is unknown — an absent badge is honest, where
 * a grey "not tested" chip on every untested fabric would just be noise. The
 * value is admin-set (guard_product_admin_columns blocks suppliers), which is
 * what makes it worth showing at all.
 */
export function TestReportBadge({ status, compact, className }: TestReportBadgeProps) {
  if (!status) return null

  const approved = status === 'approved'
  const Icon = approved ? ShieldCheck : ShieldAlert

  return (
    <span
      title={
        approved
          ? 'Independently lab tested and approved'
          : 'This fabric did not pass lab testing'
      }
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 font-mono uppercase tracking-widest',
        compact ? 'text-[9px]' : 'text-[10px]',
        approved ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
        className,
      )}
    >
      <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {approved ? 'Test passed' : 'Test failed'}
    </span>
  )
}

export default TestReportBadge
