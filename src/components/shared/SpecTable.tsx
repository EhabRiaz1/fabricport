import { cn } from '@/lib/utils'
import type { ProductSpecRow } from '@/types/app'

export interface SpecTableProps {
  rows: ProductSpecRow[]
  className?: string
  variant?: 'dark' | 'light'
}

export function SpecTable({ rows, className, variant = 'light' }: SpecTableProps) {
  if (rows.length === 0) return null

  const isDark = variant === 'dark'

  return (
    <dl className={cn('divide-y', isDark ? 'divide-border' : 'divide-border-cream', className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-2.5"
        >
          <dt
            className={cn(
              'font-mono text-[10px] uppercase tracking-widest',
              isDark ? 'text-text-muted' : 'text-text-dark-secondary',
            )}
          >
            {row.label}
          </dt>
          <dd
            className={cn(
              'font-mono text-xs text-right',
              isDark ? 'text-text-primary' : 'text-text-dark',
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default SpecTable
