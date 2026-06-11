import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap, prefersReducedMotion } from '@/lib/gsap'
import { getProductImageUrl } from '@/lib/utils'
import type { ProductWithRelations } from '@/types/app'

export interface FinaleCTAProps {
  textureProduct?: ProductWithRelations
}

/** Giant type filled with live fabric texture, over a dimmed cloth backdrop. */
export function FinaleCTA({ textureProduct }: FinaleCTAProps) {
  const sectionRef = useRef<HTMLElement>(null)

  const textureUrl = textureProduct?.images?.[0]
    ? getProductImageUrl(textureProduct.images[0], { variant: 'medium' })
    : null

  useEffect(() => {
    const section = sectionRef.current
    if (!section || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        section.querySelector('[data-finale-heading]'),
        { yPercent: 24, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 70%' },
        },
      )
      gsap.fromTo(
        section.querySelectorAll('[data-finale-meta]'),
        { y: 22, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 60%' },
        },
      )
    }, section)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#1A0E06] py-32 lg:py-44">
      <div className="grain pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-6 text-center lg:px-8">
        <p data-finale-meta className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#E8A070]">
          Join the network
        </p>

        <h2
          data-finale-heading
          className="mt-6 select-none font-display font-bold tracking-[-0.03em]"
          style={{
            fontSize: 'clamp(56px, 11vw, 170px)',
            lineHeight: 0.95,
            ...(textureUrl
              ? {
                  backgroundImage: `url(${textureUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  filter: 'brightness(1.25) saturate(1.1)',
                }
              : { color: '#F5EDE4' }),
          }}
        >
          READY
          <br />
          TO TRADE?
        </h2>

        <p
          data-finale-meta
          className="mx-auto mt-8 max-w-md text-base leading-relaxed text-[#F5EDE4]/55"
        >
          Whether you're sourcing for a collection or moving surplus inventory,
          FabricPort connects you with verified partners across Pakistan.
        </p>

        <div data-finale-meta className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/marketplace"
            className="clip-corner-sm inline-flex items-center gap-2 bg-[#F5EDE4] px-9 py-4 font-mono text-[11px] uppercase tracking-widest text-[#1A0E06] transition-colors hover:bg-accent hover:text-white"
          >
            Browse fabrics
          </Link>
          <Link
            to="/auth/register?role=supplier"
            className="inline-flex items-center gap-2 border border-white/25 px-9 py-4 font-mono text-[11px] uppercase tracking-widest text-white/80 transition-colors hover:border-accent hover:text-accent"
          >
            Join as supplier
          </Link>
        </div>
      </div>
    </section>
  )
}

export default FinaleCTA
