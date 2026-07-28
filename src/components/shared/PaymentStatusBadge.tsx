import { Badge } from '@/components/ui/badge'
import { PAYMENT_STATUS_LABELS } from '@/lib/invoices'
import type { PaymentStatus } from '@/types/database.types'

/**
 * Sibling of InquiryStatusBadge rather than an extension of it — payment status
 * is a separate axis from invoice status (an invoice can be `sent` + `partial`),
 * and widening InquiryStatus would touch the 10 files that depend on it.
 */
const VARIANTS: Record<PaymentStatus, 'warning' | 'success' | 'default'> = {
  unpaid: 'default',
  partial: 'warning',
  paid: 'success',
}

export interface PaymentStatusBadgeProps {
  status: PaymentStatus
  /** Renders an overdue treatment instead — see isOverdue() for the rule. */
  overdue?: boolean
  className?: string
}

export function PaymentStatusBadge({ status, overdue, className }: PaymentStatusBadgeProps) {
  if (overdue && status !== 'paid') {
    return (
      <Badge variant="danger" className={className}>
        Overdue
      </Badge>
    )
  }
  return (
    <Badge variant={VARIANTS[status]} className={className}>
      {PAYMENT_STATUS_LABELS[status]}
    </Badge>
  )
}

export default PaymentStatusBadge
