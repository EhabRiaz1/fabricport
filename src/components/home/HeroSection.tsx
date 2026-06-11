import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const WORDS = ['Pakistan\'s', 'Premier', 'Surplus', 'Fabric', 'Exchange.']

interface HeroSectionProps {
  backgroundImage?: string
  className?: string
}

export function HeroSection({ backgroundImage, className }: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  const imgY = useTransform(scrollYProgress, [0, 1], ['0%', '20%'])
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <section
      ref={containerRef}
      className={cn('relative flex min-h-screen flex-col justify-end overflow-hidden grain scanlines', className)}
    >
      {/* Background image with parallax */}
      <motion.div
        className="absolute inset-0 grid-overlay"
        style={{ y: imgY }}
      >
        {backgroundImage ? (
          <img
            src={backgroundImage}
            alt=""
            className="h-full w-full object-cover"
            style={{ transform: 'scale(1.15)' }}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `
                radial-gradient(ellipse 80% 60% at 60% 40%, rgba(232,89,60,0.18) 0%, transparent 60%),
                radial-gradient(ellipse 50% 80% at 20% 70%, rgba(232,89,60,0.08) 0%, transparent 50%),
                #0A0A0A
              `,
            }}
          />
        )}
      </motion.div>

      {/* Dark gradient layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/85" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent" />

      {/* Vertical accent rail — left edge */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-accent/60 to-transparent hidden lg:block" />

      {/* Content */}
      <motion.div
        className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-28 pt-40 lg:px-8 lg:pb-36"
        style={{ opacity }}
      >
        {/* Top label */}
        {mounted && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 mb-8"
          >
            <span className="h-px w-8 bg-accent" />
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent">
              B2B Fabric Marketplace
            </span>
          </motion.div>
        )}

        {/* Headline — word by word stagger */}
        <div className="overflow-hidden">
          <h1 className="font-display font-semibold leading-[0.95] tracking-[-0.02em] text-white"
            style={{ fontSize: 'clamp(52px, 8vw, 96px)' }}>
            {WORDS.map((word, i) => (
              <span key={word} className="inline-block overflow-hidden mr-[0.22em] last:mr-0">
                <motion.span
                  className="inline-block"
                  initial={{ y: '110%', opacity: 0 }}
                  animate={mounted ? { y: '0%', opacity: 1 } : {}}
                  transition={{
                    duration: 0.75,
                    delay: 0.15 + i * 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </h1>
        </div>

        {/* Sub */}
        {mounted && (
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 max-w-lg text-base leading-relaxed text-white/55 sm:text-lg"
          >
            Source verified Pakistani textiles with precision specs,
            direct supplier chat, and 3D fabric visualization.
          </motion.p>
        )}

        {/* CTAs */}
        {mounted && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              to="/marketplace"
              className="group inline-flex items-center gap-2.5 bg-accent px-6 py-3 font-mono text-xs uppercase tracking-widest text-white transition-all duration-200 hover:bg-accent-dim clip-corner-sm"
            >
              Browse Catalogue
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/vendors"
              className="group inline-flex items-center gap-2.5 border border-white/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-white/70 transition-all duration-200 hover:border-white/50 hover:text-white clip-corner-sm"
            >
              View Vendors
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        )}

        {/* Bottom corner meta */}
        {mounted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.1 }}
            className="absolute bottom-8 right-8 hidden flex-col items-end gap-1 lg:flex"
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
              Est. 2024 — Lahore
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
              PKR · USD
            </p>
          </motion.div>
        )}
      </motion.div>

      {/* Bottom coral hairline */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />

      {/* Scroll indicator */}
      {mounted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="absolute bottom-8 left-8 hidden flex-col items-center gap-2 lg:flex"
        >
          <div className="h-10 w-px bg-gradient-to-b from-white/40 to-transparent" />
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">Scroll</span>
        </motion.div>
      )}
    </section>
  )
}

export default HeroSection
