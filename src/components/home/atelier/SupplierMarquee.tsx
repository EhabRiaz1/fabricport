import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsap'
import type { SupplierWithCount } from '@/types/app'

export interface SupplierMarqueeProps {
  suppliers: SupplierWithCount[]
}

/** Infinite brand marquee whose speed reacts to scroll velocity. */
export function SupplierMarquee({ suppliers }: SupplierMarqueeProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track || suppliers.length === 0) return
    if (prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      const loop = gsap.to(track, {
        xPercent: -50,
        ease: 'none',
        duration: 36,
        repeat: -1,
      })

      ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const velocity = Math.abs(self.getVelocity())
          const boost = gsap.utils.clamp(1, 4, 1 + velocity / 900)
          gsap.to(loop, { timeScale: boost, duration: 0.4, overwrite: true })
          gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.3, overwrite: false })
        },
      })
    }, section)

    return () => ctx.revert()
  }, [suppliers.length])

  if (suppliers.length === 0) return null

  const row = [...suppliers, ...suppliers]

  return (
    <section ref={sectionRef} className="overflow-hidden border-y border-ink/10 bg-surface py-10">
      <p className="mb-7 text-center font-mono text-[9px] uppercase tracking-[0.3em] text-text-muted">
        Verified mills on FabricPort
      </p>
      <div ref={trackRef} className="flex w-max items-center gap-16 px-8">
        {row.map((supplier, index) => (
          <Link
            key={`${supplier.id}-${index}`}
            to={`/supplier/${supplier.slug}`}
            className="group flex shrink-0 items-center gap-3"
          >
            <span className="font-display text-xl font-semibold tracking-tight text-text-muted transition-colors group-hover:text-text-primary lg:text-2xl">
              {supplier.brand_name}
            </span>
            {supplier.is_verified && <span className="text-sm text-accent">✓</span>}
          </Link>
        ))}
      </div>
    </section>
  )
}

export default SupplierMarquee
