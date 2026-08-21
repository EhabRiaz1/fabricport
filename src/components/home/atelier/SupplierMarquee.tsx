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
        paused: true,
      })

      // Run only while the band is on screen. This used to be an unconditional repeat:-1
      // tween that kept the GSAP ticker busy for the entire session, including while the
      // user was three sections away.
      //
      // The velocity-reactive timeScale boost that lived here is gone: it allocated two new
      // tweens on EVERY scroll update for an effect nobody reported noticing.
      ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
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
