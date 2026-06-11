import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { ProductStatus } from '@/types/database.types'

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest',
  {
    variants: {
      variant: {
        default: 'bg-elevated px-2 py-0.5 text-text-secondary',
        verified: 'bg-accent/15 px-2 py-0.5 text-accent',
        status: 'border border-border-cream px-2 py-0.5 text-text-dark-secondary',
        success: 'bg-success/15 px-2 py-0.5 text-success',
        warning: 'bg-warning/15 px-2 py-0.5 text-warning',
        danger: 'bg-danger/15 px-2 py-0.5 text-danger',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Draft',
  pending_listing_request: 'Pending',
  fabric_received: 'Received',
  scanning: 'Scanning',
  ready_to_publish: 'Ready',
  published: 'Published',
  archived: 'Archived',
}

const STATUS_VARIANT: Record<ProductStatus, BadgeProps['variant']> = {
  draft: 'default',
  pending_listing_request: 'warning',
  fabric_received: 'status',
  scanning: 'status',
  ready_to_publish: 'success',
  published: 'success',
  archived: 'default',
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: ProductStatus
}

function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className} {...props}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export interface VerifiedBadgeProps extends Omit<BadgeProps, 'variant'> {
  label?: string
}

function VerifiedBadge({ label = 'Verified', className, ...props }: VerifiedBadgeProps) {
  return (
    <Badge variant="verified" className={className} {...props}>
      {label}
    </Badge>
  )
}

export { Badge, badgeVariants, StatusBadge, VerifiedBadge }
