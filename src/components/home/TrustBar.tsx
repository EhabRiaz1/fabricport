import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { TrustBarItem as StatItem } from '@/types/app'

const DEFAULT_STATS: StatItem[] = [
  { label: 'Verified Suppliers', value: '8+', numeric: 8, suffix: '+' },
  { label: 'Fabric SKUs', value: '205+', numeric: 205, suffix: '+' },
  { label: 'Categories', value: '3', numeric: 3 },
  { label: 'Avg. Response', value: '<4h', prefix: '<', suffix: 'h', numeric: 4 },
]

function useCountUp(target: number, duration = 1200, active = false) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!active) return
    const start = performance.now()
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [active, target, duration])

  return count
}

function StatCell({ item, active }: { item: StatItem; active: boolean }) {
  const count = useCountUp(item.numeric ?? 0, 1000, active && !!item.numeric)
  const display = item.numeric
    ? `${item.prefix ?? ''}${count}${item.suffix ?? ''}`
    : item.value

  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      <span
        className="font-display font-semibold tabular-nums text-text-primary"
        style={{ fontSize: 'clamp(32px, 4vw, 52px)', letterSpacing: '-0.03em', lineHeight: 1 }}
      >
        {display}
      </span>
      <span className="mt-3 font-mono text-[9px] uppercase tracking-[0.22em] text-text-muted">
        {item.label}
      </span>
    </div>
  )
}

interface TrustBarProps {
  items?: StatItem[]
  className?: string
}


export function TrustBar({ items = DEFAULT_STATS, className }: TrustBarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section
      ref={ref}
      className={cn('relative border-y border-border bg-surface overflow-hidden', className)}
    >
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-overlay opacity-50" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-2 divide-x divide-border md:grid-cols-4">
        {items.map((item) => (
          <StatCell key={item.label} item={item} active={inView} />
        ))}
      </div>

      {/* Accent line bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
    </section>
  )
}

export default TrustBar
