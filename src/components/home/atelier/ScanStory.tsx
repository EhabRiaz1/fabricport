import { useEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'
import { getProductImageUrl } from '@/lib/utils'
import type { ProductWithRelations } from '@/types/app'

export interface ScanStoryProps {
  product?: ProductWithRelations
}

/**
 * Pinned scroll-scrubbed sequence: a fabric swatch is measured before your
 * eyes — annotation lines draw themselves like calipers, then the swatch
 * tilts into 3D space.
 */
export function ScanStory({ product }: ScanStoryProps) {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const reduced = prefersReducedMotion()
    const ctx = gsap.context(() => {
      const swatch = section.querySelector('[data-scan-swatch]')
      const annotations = section.querySelectorAll<SVGPathElement | SVGLineElement>(
        '[data-scan-line]',
      )
      const labels = section.querySelectorAll('[data-scan-label]')
      const headline = section.querySelectorAll('[data-scan-copy]')

      annotations.forEach((line) => {
        const length = (line as SVGPathElement).getTotalLength?.() ?? 200
        line.style.strokeDasharray = `${length}`
        line.style.strokeDashoffset = reduced ? '0' : `${length}`
      })

      if (reduced) {
        gsap.set([labels, headline], { opacity: 1 })
        return
      }

      gsap.set(labels, { opacity: 0, y: 10 })
      gsap.set(headline, { opacity: 0, y: 24 })
      gsap.set(swatch, { rotateX: 0, rotateY: 0, scale: 0.94 })

      // Sticky inner + scrub across the tall section (no ScrollTrigger pin).
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.5,
        },
      })

      tl.to(headline, { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 })
        .to(swatch, { scale: 1, duration: 0.6 }, '<')
        .to(annotations, { strokeDashoffset: 0, duration: 1.2, stagger: 0.15 }, '-=0.2')
        .to(labels, { opacity: 1, y: 0, duration: 0.5, stagger: 0.12 }, '-=0.6')
        .to(swatch, { rotateX: 18, rotateY: -14, duration: 1.2, ease: 'power1.inOut' }, '+=0.2')
        .to(swatch, { rotateX: 8, rotateY: 10, duration: 1.2, ease: 'power1.inOut' })
    }, section)

    return () => ctx.revert()
  }, [])

  const image = product?.images?.[0]
    ? getProductImageUrl(product.images[0], { variant: 'medium' })
    : null

  return (
    <section ref={sectionRef} className="relative bg-[#EDE6D8]" style={{ height: '260vh' }}>
      <div className="sticky top-0 flex min-h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-16 px-6 py-24 lg:grid-cols-2 lg:px-8">
          {/* Copy */}
          <div>
            <p data-scan-copy className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">
              Vizu scan technology
            </p>
            <h2
              data-scan-copy
              className="mt-4 font-display font-bold tracking-tight text-text-primary"
              style={{ fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 0.98 }}
            >
              Every thread,
              <br />
              measured.
            </h2>
            <p data-scan-copy className="mt-6 max-w-md text-base leading-relaxed text-text-secondary">
              Each fabric we list is physically received, scanned in 4K, and
              measured by hand — GSM, width, shrinkage, composition. What you
              see is what arrives.
            </p>
            <div data-scan-copy className="mt-10 flex items-center gap-10">
              {[
                { value: '360°', label: 'View' },
                { value: '4K', label: 'Detail' },
                { value: '±0.5%', label: 'Tolerance' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-display text-3xl font-bold text-text-primary">{stat.value}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.24em] text-text-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Measured swatch */}
          {/* The drop shadow lives on this untransformed wrapper, not on the rotating
              element. A large blurred box-shadow on a element being scrubbed through
              rotateX/rotateY is re-rasterised on every frame of the scroll. */}
          <div
            className="relative mx-auto w-full max-w-[440px] shadow-lg shadow-[#50321433]"
            style={{ perspective: '1200px' }}
          >
            <div
              data-scan-swatch
              className="clip-corner relative aspect-[4/5] overflow-hidden bg-[#C8B49A]"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {image ? (
                <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#C8B49A] to-[#907C60]" />
              )}
              {/* Scanline sweep */}
              <div className="scanlines absolute inset-0" />
            </div>

            {/* Annotation overlay */}
            <svg
              viewBox="0 0 440 550"
              fill="none"
              className="pointer-events-none absolute -inset-6 h-[calc(100%+48px)] w-[calc(100%+48px)]"
              aria-hidden
            >
              {/* Width caliper */}
              <line data-scan-line x1="24" y1="20" x2="416" y2="20" stroke="#7A4A28" strokeWidth="1.5" />
              <line data-scan-line x1="24" y1="12" x2="24" y2="28" stroke="#7A4A28" strokeWidth="1.5" />
              <line data-scan-line x1="416" y1="12" x2="416" y2="28" stroke="#7A4A28" strokeWidth="1.5" />
              {/* Height caliper */}
              <line data-scan-line x1="430" y1="44" x2="430" y2="526" stroke="#7A4A28" strokeWidth="1.5" />
              <line data-scan-line x1="422" y1="44" x2="438" y2="44" stroke="#7A4A28" strokeWidth="1.5" />
              <line data-scan-line x1="422" y1="526" x2="438" y2="526" stroke="#7A4A28" strokeWidth="1.5" />
              {/* Weave detail circle */}
              <circle data-scan-line cx="120" cy="380" r="46" stroke="#E8593C" strokeWidth="1.5" />
              <line data-scan-line x1="158" y1="352" x2="248" y2="300" stroke="#E8593C" strokeWidth="1.2" />
            </svg>

            {/* Mono labels */}
            <span
              data-scan-label
              className="absolute -top-12 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-bronze"
            >
              60" usable width
            </span>
            <span
              data-scan-label
              className="absolute -right-9 top-1/2 -translate-y-1/2 rotate-90 font-mono text-[10px] uppercase tracking-[0.2em] text-bronze"
            >
              Drop length
            </span>
            <span
              data-scan-label
              className="absolute left-[56%] top-[48%] bg-[#140A04]/85 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#E8A070]"
            >
              220 GSM · twill weave
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ScanStory
