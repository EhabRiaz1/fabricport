import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'

export interface NumbersBandProps {
  fabrics: number | null
  mills: number | null
  metersListed: number | null
}

export function NumbersBand({ fabrics, mills, metersListed }: NumbersBandProps) {
  const sectionRef = useRef<HTMLElement>(null)

  const stats = [
    { value: fabrics ?? 0, suffix: '', label: 'Fabrics catalogued' },
    { value: mills ?? 0, suffix: '', label: 'Verified mills' },
    { value: metersListed ?? 0, suffix: 'm', label: 'Meters in stock' },
    { value: 24, suffix: 'h', label: 'Avg. first response' },
  ]

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const counters = section.querySelectorAll<HTMLElement>('[data-count]')
    if (prefersReducedMotion()) {
      counters.forEach((el) => {
        el.textContent = `${Number(el.dataset.count ?? 0).toLocaleString()}${el.dataset.suffix ?? ''}`
      })
      return
    }

    const ctx = gsap.context(() => {
      counters.forEach((el) => {
        const target = Number(el.dataset.count ?? 0)
        const suffix = el.dataset.suffix ?? ''
        const proxy = { value: 0 }
        gsap.to(proxy, {
          value: target,
          duration: 1.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
          onUpdate: () => {
            el.textContent = `${Math.round(proxy.value).toLocaleString()}${suffix}`
          },
        })
      })
    }, section)

    return () => ctx.revert()
  }, [fabrics, mills, metersListed])

  return (
    <section ref={sectionRef} className="border-y border-ink/10 bg-ink">
      <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/10 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="px-6 py-12 text-center lg:py-16">
            <p
              data-count={stat.value}
              data-suffix={stat.suffix}
              className="font-display font-bold tracking-tight text-[#F5EDE4]"
              style={{ fontSize: 'clamp(30px, 4vw, 56px)' }}
            >
              0
            </p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.26em] text-[#F5EDE4]/40">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default NumbersBand
