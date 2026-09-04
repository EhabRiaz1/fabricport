import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap, prefersReducedMotion } from '@/lib/gsap'
import { cn, formatPrice, getProductImageUrl } from '@/lib/utils'
import type { ProductWithRelations } from '@/types/app'

export interface FeaturedGridProps {
  products: ProductWithRelations[]
}

/** Asymmetric editorial grid of real catalogue pieces. */
export function FeaturedGrid({ products }: FeaturedGridProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const items = products.slice(0, 5)

  useEffect(() => {
    const section = sectionRef.current
    if (!section || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      section.querySelectorAll('[data-feature-tile]').forEach((tile, index) => {
        // The reveal used to animate clipPath: inset(), which is not compositable and
        // forced a full repaint of the tile on every frame, x5 tiles. A solid overlay panel
        // slid down on yPercent is visually near-identical and runs on the compositor.
        const wipe = tile.querySelector('[data-feature-wipe]')
        if (wipe) {
          gsap.fromTo(
            wipe,
            { yPercent: 0 },
            {
              yPercent: 100,
              duration: 1,
              delay: (index % 3) * 0.08,
              ease: 'power3.out',
              scrollTrigger: { trigger: tile, start: 'top 86%' },
            },
          )
        }
        gsap.fromTo(
          tile,
          { y: 40 },
          {
            y: 0,
            duration: 1,
            delay: (index % 3) * 0.08,
            ease: 'power3.out',
            scrollTrigger: { trigger: tile, start: 'top 86%' },
          },
        )
        // Inner image parallax
        const img = tile.querySelector('img')
        if (img) {
          gsap.fromTo(
            img,
            { yPercent: -8 },
            {
              yPercent: 8,
              ease: 'none',
              scrollTrigger: {
                trigger: tile,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            },
          )
        }
      })
    }, section)

    return () => ctx.revert()
  }, [items.length])

  if (items.length === 0) return null

  return (
    <section ref={sectionRef} className="bg-background py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">
              From the catalogue
            </p>
            <h2
              className="mt-3 font-display font-bold tracking-tight text-text-primary"
              style={{ fontSize: 'clamp(30px, 4.5vw, 56px)', lineHeight: 1 }}
            >
              Featured fabrics
            </h2>
          </div>
          <Link
            to="/marketplace"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-bronze transition-colors hover:text-accent"
          >
            Browse all →
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4 md:grid-rows-2 lg:gap-6">
          {items.map((product, index) => {
            const image = product.images[0]
              ? getProductImageUrl(product.images[0], {
                  variant: index === 0 ? 'medium' : 'card',
                })
              : null
            const price = product.price_min_pkr
              ? `${formatPrice(product.price_min_pkr, 'PKR')}/m`
              : null

            return (
              <Link
                key={product.id}
                to={`/fabric/${product.slug}`}
                // Product tiles open in a new tab everywhere, so the homepage, the
                // marketplace grid and the quick-view modal all behave the same.
                target="_blank"
                rel="noopener noreferrer"
                data-feature-tile
                className={cn(
                  'group relative block overflow-hidden clip-corner bg-elevated',
                  index === 0
                    ? 'col-span-2 row-span-2 aspect-square md:aspect-auto'
                    : 'aspect-square',
                )}
              >
                {image && (
                  <img
                    src={image}
                    alt={product.title}
                    loading="lazy"
                    className="h-[112%] w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                )}
                {/* Reveal curtain, slid away on yPercent by the ScrollTrigger above.
                    Replaces an inset() clip-path animation that repainted every frame. */}
                <div
                  data-feature-wipe
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-10 bg-background will-change-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E06]/75 via-transparent to-transparent opacity-70 transition-opacity duration-300 group-hover:opacity-90" />
                <div className="absolute inset-x-0 bottom-0 p-4 lg:p-5">
                  <p
                    className={cn(
                      'truncate font-display font-semibold tracking-tight text-[#F5EDE4]',
                      index === 0 ? 'text-2xl' : 'text-base',
                    )}
                  >
                    {product.title}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-[#F5EDE4]/55">
                      {product.supplier?.brand_name}
                    </p>
                    {price && (
                      <p className="shrink-0 font-mono text-[10px] text-[#E8A070] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        {price}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default FeaturedGrid
