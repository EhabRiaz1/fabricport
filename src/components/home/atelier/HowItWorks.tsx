import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'

const STEPS = [
  {
    number: '01',
    title: 'Browse',
    body: 'Search the catalogue by colour, GSM, composition, and price. Every listing is scanned and spec-verified in-house.',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
        <circle data-draw cx="28" cy="28" r="16" stroke="currentColor" strokeWidth="2" />
        <line data-draw x1="40" y1="40" x2="52" y2="52" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Inquire',
    body: 'Add fabrics to your inquiry and chat directly with the mill. Negotiate quantity, price, and delivery in one thread.',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
        <path
          data-draw
          d="M10 14h44v30H30l-12 10v-10h-8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <line data-draw x1="20" y1="26" x2="44" y2="26" stroke="currentColor" strokeWidth="2" />
        <line data-draw x1="20" y1="33" x2="36" y2="33" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Receive',
    body: 'Confirm with a proforma invoice and receive exactly the fabric you saw — same roll, same dye lot, same specs.',
    icon: (
      <svg viewBox="0 0 64 64" fill="none" className="h-16 w-16">
        <path
          data-draw
          d="M32 8l22 12v24L32 56 10 44V20z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path data-draw d="M10 20l22 12 22-12" stroke="currentColor" strokeWidth="2" />
        <line data-draw x1="32" y1="32" x2="32" y2="56" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
]

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const reduced = prefersReducedMotion()
    const ctx = gsap.context(() => {
      const lines = section.querySelectorAll<SVGPathElement>('[data-draw]')
      lines.forEach((line) => {
        const length = line.getTotalLength?.() ?? 160
        line.style.strokeDasharray = `${length}`
        line.style.strokeDashoffset = reduced ? '0' : `${length}`
      })

      if (reduced) return

      section.querySelectorAll('[data-step]').forEach((step, index) => {
        const stepLines = step.querySelectorAll('[data-draw]')
        const copy = step.querySelectorAll('[data-step-copy]')
        gsap.set(copy, { opacity: 0, y: 18 })

        gsap
          .timeline({ scrollTrigger: { trigger: step, start: 'top 80%' }, delay: index * 0.05 })
          .to(stepLines, { strokeDashoffset: 0, duration: 1.1, stagger: 0.15, ease: 'power2.inOut' })
          .to(copy, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08 }, '-=0.7')
      })
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="bg-[#EDE6D8] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">
          How it works
        </p>
        <h2
          className="mt-3 font-display font-bold tracking-tight text-text-primary"
          style={{ fontSize: 'clamp(30px, 4.5vw, 56px)', lineHeight: 1 }}
        >
          Three steps to the roll
        </h2>

        <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
          {STEPS.map((step) => (
            <div key={step.number} data-step className="relative">
              <span className="absolute -top-8 right-0 font-display text-7xl font-bold tracking-tight text-ink/[0.06]">
                {step.number}
              </span>
              <div className="text-bronze">{step.icon}</div>
              <h3
                data-step-copy
                className="mt-6 font-display text-2xl font-semibold tracking-tight text-text-primary"
              >
                {step.title}
              </h3>
              <p data-step-copy className="mt-3 max-w-xs text-sm leading-relaxed text-text-secondary">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
