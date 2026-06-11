import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AdminPageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export function AdminPageHeader({ title, description, actions, className }: AdminPageHeaderProps) {
  return (
    <div className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Admin</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export default AdminPageHeader
