import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function JoinSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="relative overflow-hidden border-t border-border bg-surface py-28 lg:py-36 grain">
      {/* Grid overlay */}
      <div className="absolute inset-0 grid-overlay opacity-40" />

      {/* Accent gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_50%_100%,rgba(232,89,60,0.12),transparent)]" />

      {/* Large watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
        <span
          className="font-display font-semibold text-text-primary/[0.022] whitespace-nowrap"
          style={{ fontSize: 'clamp(64px, 14vw, 200px)', letterSpacing: '-0.04em' }}
        >
          FABRICPORT
        </span>
      </div>

      <div ref={ref} className="relative mx-auto max-w-7xl px-6 text-center lg:px-8">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-8 h-px w-16 bg-accent origin-center"
        />

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-mono text-[9px] uppercase tracking-[0.28em] text-accent"
        >
          For Suppliers
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-4 max-w-3xl font-display font-semibold tracking-tight text-text-primary"
          style={{ fontSize: 'clamp(32px, 5vw, 60px)', lineHeight: 1.05 }}
        >
          List your surplus fabric.<br />
          <span className="text-text-secondary">Reach verified buyers.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-text-secondary"
        >
          FabricPort's Vizu scanner photographs and lists your inventory in 3D.
          Buyers browse with precision specs before ever reaching out — meaning
          higher-quality inquiries and faster conversions.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.42 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            to="/auth/register"
            className="group inline-flex items-center gap-2.5 bg-accent px-8 py-3.5 font-mono text-[10px] uppercase tracking-widest text-white transition-all hover:bg-accent-dim clip-corner-sm"
          >
            Join as a Supplier
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/marketplace"
            className="group inline-flex items-center gap-2.5 border border-border px-8 py-3.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:border-accent hover:text-accent clip-corner-sm"
          >
            Browse as Buyer
          </Link>
        </motion.div>

        {/* Bottom stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-12"
        >
          {[
            ['No listing fee', 'Free to list'],
            ['3D Vizu scan', 'Included'],
            ['Real-time chat', 'With buyers'],
          ].map(([title, sub]) => (
            <div key={title} className="text-center">
              <p className="font-display text-sm font-semibold text-text-primary">{title}</p>
              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-widest text-text-muted">{sub}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default JoinSection
