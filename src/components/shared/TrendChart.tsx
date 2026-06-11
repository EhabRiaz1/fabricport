import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

export interface TrendPoint {
  label: string
  value: number
}

export interface TrendChartProps {
  data: TrendPoint[]
  className?: string
  /** Bar fill (defaults to accent). */
  color?: string
  height?: number
  emptyLabel?: string
}

/** Dependency-free SVG bar chart in the editorial style — hover for values. */
export function TrendChart({
  data,
  className,
  color = 'var(--color-accent)',
  height = 160,
  emptyLabel = 'No data yet',
}: TrendChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const max = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data])
  const hasData = data.some((d) => d.value > 0)

  if (data.length === 0 || !hasData) {
    return (
      <div
        className={cn(
          'flex items-center justify-center border border-dashed border-border bg-surface/50',
          className,
        )}
        style={{ height }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          {emptyLabel}
        </p>
      </div>
    )
  }

  const gap = 6
  const barWidth = `calc(${100 / data.length}% - ${gap}px)`

  return (
    <div className={className}>
      <div className="relative flex items-end gap-[6px]" style={{ height }}>
        {data.map((point, index) => {
          const h = Math.max((point.value / max) * 100, point.value > 0 ? 3 : 1)
          return (
            <div
              key={`${point.label}-${index}`}
              className="group relative flex h-full items-end"
              style={{ width: barWidth }}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              <div
                className="w-full transition-all duration-300"
                style={{
                  height: `${h}%`,
                  backgroundColor: color,
                  opacity: active == null || active === index ? 0.9 : 0.35,
                }}
              />
              {active === index && (
                <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-ink px-2.5 py-1 font-mono text-[10px] text-[#F5EDE4]">
                  {point.value.toLocaleString()} · {point.label}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-muted">
          {data[0]?.label}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-muted">
          {data[data.length - 1]?.label}
        </span>
      </div>
    </div>
  )
}

export default TrendChart
