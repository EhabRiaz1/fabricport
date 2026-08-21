import { cn } from '@/lib/utils'

export interface CountBadgeProps {
  count: number
  className?: string
  /** Hide entirely at zero rather than showing a 0. */
  hideAtZero?: boolean
}

/**
 * Small numeric badge for the nav cart and the chat launcher.
 *
 * A square, not a circle: the design language has no circles except colour dots, so a pill
 * or a dot here would read as imported from another product.
 */
export function CountBadge({ count, className, hideAtZero = true }: CountBadgeProps) {
  if (hideAtZero && count <= 0) return null
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-4 min-w-4 place-items-center bg-accent px-1 font-mono text-[9px] leading-none tabular-nums text-white',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export default CountBadge
