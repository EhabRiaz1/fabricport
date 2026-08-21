import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap, prefersReducedMotion } from '@/lib/gsap'
import { cn } from '@/lib/utils'
import { COLOR_FAMILIES, type ColorFamily } from '@/lib/color/classify'

const SWATCHES: Record<ColorFamily, { hex: string; tint: string }> = {
  black: { hex: '#1F1B17', tint: '#E7E2DA' },
  white: { hex: '#F4F1EA', tint: '#F8F5EE' },
  gray: { hex: '#8C8579', tint: '#EFEBE3' },
  beige: { hex: '#D4C4A8', tint: '#F4ECDC' },
  brown: { hex: '#6B4423', tint: '#EFE2D2' },
  red: { hex: '#B13A2C', tint: '#F4DFD8' },
  orange: { hex: '#E8593C', tint: '#F8E4DA' },
  yellow: { hex: '#D9A511', tint: '#F7EDD2' },
  green: { hex: '#2E7D4F', tint: '#DFEBDD' },
  blue: { hex: '#2C5F8A', tint: '#DDE7EE' },
  purple: { hex: '#6E4685', tint: '#E9E0EE' },
  pink: { hex: '#D4548C', tint: '#F6DFE9' },
}

/** Interactive ribbon of the twelve colour families. Hover tints the room. */
export function ColorRibbon() {
  const sectionRef = useRef<HTMLElement>(null)
  const [active, setActive] = useState<ColorFamily | null>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      gsap.from(section.querySelectorAll('[data-ribbon-swatch]'), {
        yPercent: 60,
        opacity: 0,
        duration: 0.7,
        stagger: 0.045,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 72%',
        },
      })
    }, section)

    return () => ctx.revert()
  }, [])

  /**
   * The room tint is written straight to a CSS custom property on the section rather than
   * held in React state. Previously every hover across the twelve links set state, which
   * re-rendered all twelve and repainted the full-width section for 700ms. `active` is still
   * state, but only because the heading word needs it -- the tint no longer costs a render.
   */
  const setTint = (family: ColorFamily | null) => {
    setActive(family)
    sectionRef.current?.style.setProperty(
      '--ribbon-tint',
      family ? SWATCHES[family].tint : '#F6F1E9',
    )
  }

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-28 lg:py-36"
      style={{
        backgroundColor: 'var(--ribbon-tint, #F6F1E9)',
        transition: 'background-color 500ms ease',
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">
              The colour library
            </p>
            <h2
              className="mt-3 font-display font-bold tracking-tight text-text-primary"
              style={{ fontSize: 'clamp(30px, 4.5vw, 56px)', lineHeight: 1 }}
            >
              {active ? (
                <span className="capitalize">{active}</span>
              ) : (
                'Twelve families'
              )}
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
            Every fabric is colour-classified from its scan. Pick a family to
            browse everything in that shade.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
          {COLOR_FAMILIES.map((family) => (
            <Link
              key={family}
              to={`/marketplace?colors=${family}`}
              data-ribbon-swatch
              onMouseEnter={() => setTint(family)}
              onMouseLeave={() => setTint(null)}
              className="group block"
            >
              <span
                className={cn(
                  'clip-corner-sm block aspect-[3/4] border border-ink/10 transition-all duration-300',
                  active === family
                    ? 'scale-[1.06] shadow-lg shadow-ink/15'
                    : 'group-hover:scale-[1.04]',
                )}
                style={{ backgroundColor: SWATCHES[family].hex }}
              />
              <span className="mt-2 block text-center font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted transition-colors group-hover:text-text-primary">
                {family}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ColorRibbon
