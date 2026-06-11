import { Badge } from '@/components/ui/badge'
import type { InquiryStatus } from '@/types/database.types'

const STATUS_LABELS: Record<InquiryStatus, string> = {
  open: 'Open',
  responded: 'Responded',
  negotiating: 'Negotiating',
  closed: 'Closed',
  archived: 'Archived',
}

const STATUS_VARIANT: Record<
  InquiryStatus,
  'default' | 'success' | 'warning' | 'status' | 'danger'
> = {
  open: 'warning',
  responded: 'status',
  negotiating: 'default',
  closed: 'success',
  archived: 'default',
}

export interface InquiryStatusBadgeProps {
  status: InquiryStatus
  className?: string
}

export function InquiryStatusBadge({ status, className }: InquiryStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
