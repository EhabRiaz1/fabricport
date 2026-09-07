import { cn } from '@/lib/utils'
import type { ProductSpecRow } from '@/types/app'

export interface SpecTableProps {
  rows: ProductSpecRow[]
  className?: string
  variant?: 'dark' | 'light'
  /**
   * Two columns with the label stacked above its value, instead of one full-width row per
   * spec. Roughly half the height, which is what lets the quick-view modal fit on a phone
   * without scrolling. The detail page keeps the single-column list, where the extra room
   * makes it easier to scan.
   */
  dense?: boolean
}

export function SpecTable({ rows, className, variant = 'light', dense }: SpecTableProps) {
  if (rows.length === 0) return null

  const isDark = variant === 'dark'
  const labelClass = cn(
    'font-mono text-[10px] uppercase tracking-widest',
    isDark ? 'text-text-muted' : 'text-text-dark-secondary',
  )
  const valueClass = cn('font-mono text-xs', isDark ? 'text-text-primary' : 'text-text-dark')

  if (dense) {
    return (
      <dl
        className={cn(
          'grid grid-cols-2 gap-x-4 gap-y-2.5 border-t pt-2.5',
          isDark ? 'border-border' : 'border-border-cream',
          className,
        )}
      >
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className={cn(labelClass, 'text-[9px]')}>{row.label}</dt>
            <dd className={cn(valueClass, 'mt-0.5 break-words')}>{row.value}</dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <dl className={cn('divide-y', isDark ? 'divide-border' : 'divide-border-cream', className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-2.5"
        >
          <dt className={labelClass}>{row.label}</dt>
          <dd className={cn(valueClass, 'text-right')}>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default SpecTable
