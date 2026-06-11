import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsap'
import { getProductImageUrl } from '@/lib/utils'
import type { ProductWithRelations } from '@/types/app'

export interface MaterialStripProps {
  products: ProductWithRelations[]
}

function getSpec(product: ProductWithRelations, slug: string): string | null {
  const match = product.attributes?.find((attr) => attr.attribute?.slug === slug)
  if (!match) return null
  return match.value_text ?? (match.value_number != null ? String(match.value_number) : null)
}

/** Pinned horizontal gallery — vertical scroll drives a sideways material walk. */
export function MaterialStrip({ products }: MaterialStripProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = sectionRef.current
    const track = trackRef.current
    if (!section || !track || products.length === 0) return
    if (prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      const distance = () => Math.max(track.scrollWidth - window.innerWidth, 0)

      // Sticky inner + scrubbed translate (no ScrollTrigger pinning — pin
      // spacers fight React reconciliation).
      gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      })

      // Velocity-reactive skew on the tiles
      const proxy = { skew: 0 }
      const clamp = gsap.utils.clamp(-6, 6)
      ScrollTrigger.create({
        trigger: section,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => {
          const skew = clamp(self.getVelocity() / -260)
          if (Math.abs(skew) > Math.abs(proxy.skew)) {
            proxy.skew = skew
            gsap.to(proxy, {
              skew: 0,
              duration: 0.7,
              ease: 'power3.out',
              overwrite: true,
              onUpdate: () => {
                track.style.setProperty('--strip-skew', `${proxy.skew}deg`)
              },
            })
          }
        },
      })
    }, section)

    return () => ctx.revert()
  }, [products.length])

  if (products.length === 0) return null

  return (
    <section ref={sectionRef} className="relative bg-background" style={{ height: '280vh' }}>
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-6 pb-10 lg:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">
            The material library
          </p>
          <h2
            className="mt-3 font-display font-bold tracking-tight text-text-primary"
            style={{ fontSize: 'clamp(30px, 4.5vw, 56px)', lineHeight: 1 }}
          >
            Walk the racks
          </h2>
        </div>

        <div ref={trackRef} className="flex w-max gap-6 pl-6 pr-[20vw] lg:pl-8">
          {products.map((product, index) => {
            const image = product.images[0]
              ? getProductImageUrl(product.images[0], { variant: 'medium' })
              : null
            const gsm = getSpec(product, 'weight-before-wash') ?? getSpec(product, 'gsm')
            const width = getSpec(product, 'width-inches') ?? getSpec(product, 'width')

            return (
              <Link
                key={product.id}
                to={`/fabric/${product.slug}`}
                className="group relative block w-[68vw] shrink-0 sm:w-[44vw] lg:w-[30vw]"
                style={{ transform: 'skewX(var(--strip-skew, 0deg))' }}
              >
                <div className="clip-corner relative aspect-[4/5] overflow-hidden bg-elevated">
                  {image && (
                    <img
                      src={image}
                      alt={product.title}
                      loading={index < 3 ? 'eager' : 'lazy'}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E06]/70 via-transparent to-transparent opacity-80" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                    <div className="min-w-0">
                      <p className="truncate font-display text-lg font-semibold tracking-tight text-[#F5EDE4]">
                        {product.title}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.2em] text-[#F5EDE4]/55">
                        {product.supplier?.brand_name}
                      </p>
                    </div>
                    {product.color_hex && (
                      <span
                        className="h-6 w-6 shrink-0 border border-white/30"
                        style={{ backgroundColor: product.color_hex }}
                      />
                    )}
                  </div>
                  {/* Spec chips on hover */}
                  <div className="absolute left-4 top-4 flex gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    {gsm && (
                      <span className="bg-[#140A04]/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-[#E8A070] backdrop-blur-sm">
                        {gsm} gsm
                      </span>
                    )}
                    {width && (
                      <span className="bg-[#140A04]/70 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-[#E8A070] backdrop-blur-sm">
                        {width}" wide
                      </span>
                    )}
                  </div>
                </div>
                <span className="mt-3 block font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </Link>
            )
          })}

          {/* Terminal CTA tile */}
          <Link
            to="/marketplace"
            className="clip-corner group flex w-[58vw] shrink-0 items-center justify-center bg-ink sm:w-[36vw] lg:w-[24vw]"
            style={{ transform: 'skewX(var(--strip-skew, 0deg))' }}
          >
            <div className="text-center">
              <p
                className="font-display font-bold tracking-tight text-[#F5EDE4] transition-colors group-hover:text-accent"
                style={{ fontSize: 'clamp(22px, 2.6vw, 34px)' }}
              >
                View all →
              </p>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#F5EDE4]/45">
                Full catalogue
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}

export default MaterialStrip
