import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown } from 'lucide-react'
import { gsap, ScrollTrigger, prefersReducedMotion } from '@/lib/gsap'
import { supabase } from '@/lib/supabase'
import { getFxRate } from '@/lib/fx'
import { FabricClothCanvas } from './FabricClothCanvas'

interface HeroStats {
  fabrics: number | null
  mills: number | null
  fxRate: number | null
}

const HEADLINE_LINES = ['FABRIC,', 'SOURCED', 'BEAUTIFULLY.']

export function AtelierHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollProgressRef = useRef(0)
  const [stats, setStats] = useState<HeroStats>({ fabrics: null, mills: null, fxRate: null })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [productsRes, suppliersRes, rate] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'published'),
        supabase
          .from('suppliers')
          .select('id', { count: 'exact', head: true })
          .eq('is_verified', true),
        getFxRate().catch(() => null),
      ])
      if (cancelled) return
      setStats({
        fabrics: productsRes.count ?? null,
        mills: suppliersRes.count ?? null,
        fxRate: rate,
      })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const section = sectionRef.current
    const content = contentRef.current
    if (!section || !content) return

    const reduced = prefersReducedMotion()
    const ctx = gsap.context(() => {
      // Entrance choreography
      const lines = content.querySelectorAll('[data-hero-line]')
      const meta = content.querySelectorAll('[data-hero-meta]')

      if (reduced) {
        gsap.set([lines, meta], { opacity: 1, yPercent: 0, y: 0 })
      } else {
        gsap.set(lines, { yPercent: 110 })
        gsap.set(meta, { opacity: 0, y: 18 })
        const tl = gsap.timeline({ delay: 0.15 })
        tl.to(lines, {
          yPercent: 0,
          duration: 1.1,
          stagger: 0.12,
          ease: 'power4.out',
        }).to(
          meta,
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: 'power2.out' },
          '-=0.55',
        )
      }

      // Scroll: feed progress to the cloth + parallax the content away
      ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          scrollProgressRef.current = self.progress
        },
      })

      if (!reduced) {
        gsap.to(content, {
          yPercent: -18,
          opacity: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '85% top',
            scrub: true,
          },
        })
      }
    }, section)

    return () => ctx.revert()
  }, [])

  const ticker = [
    stats.fabrics != null ? `${stats.fabrics} fabrics listed` : 'Live catalogue',
    stats.mills != null ? `${stats.mills} verified mills` : 'Verified mills',
    stats.fxRate != null ? `USD/PKR ${Math.round(stats.fxRate)}` : 'Live FX',
    'Lahore · Karachi · Faisalabad',
  ]

  return (
    <section ref={sectionRef} className="relative min-h-screen overflow-hidden bg-[#1A0E06]">
      <FabricClothCanvas scrollProgressRef={scrollProgressRef} />

      {/* Soft readability gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#140A04]/55 via-transparent to-[#140A04]/75" />
      <div className="grain pointer-events-none absolute inset-0" />

      <div
        ref={contentRef}
        className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center"
      >
        <p
          data-hero-meta
          className="mb-8 font-mono text-[10px] uppercase tracking-[0.34em] text-[#E8A070]"
        >
          Pakistan's B2B fabric marketplace
        </p>

        {HEADLINE_LINES.map((line) => (
          <div key={line} className="overflow-hidden py-[0.06em]">
            <h1
              data-hero-line
              className="font-display font-bold leading-[0.92] tracking-[-0.04em] text-[#F5EDE4]"
              style={{ fontSize: 'clamp(52px, 10.5vw, 152px)' }}
            >
              {line}
            </h1>
          </div>
        ))}

        <div data-hero-meta className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/marketplace"
            className="clip-corner-sm inline-flex items-center gap-2 bg-[#F5EDE4] px-9 py-4 font-mono text-[11px] uppercase tracking-widest text-[#1A0E06] transition-colors hover:bg-accent hover:text-white"
          >
            Browse fabrics
          </Link>
          <Link
            to="/sell"
            className="inline-flex items-center gap-2 border border-white/25 px-9 py-4 font-mono text-[11px] uppercase tracking-widest text-white/80 transition-colors hover:border-accent hover:text-accent"
          >
            Sell fabrics
          </Link>
        </div>

        {/* Live stats ticker */}
        <div
          data-hero-meta
          className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#140A04]/40 backdrop-blur-sm"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-6 py-4 lg:px-8">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-1">
              {ticker.map((item) => (
                <span
                  key={item}
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/45"
                >
                  {item}
                </span>
              ))}
            </div>
            <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 sm:flex">
              Scroll
              <ArrowDown className="h-3.5 w-3.5 animate-bounce" />
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AtelierHero
