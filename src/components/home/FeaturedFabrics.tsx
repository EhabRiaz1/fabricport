import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FabricCard } from '@/components/marketplace/FabricCard'
import type { FeaturedProduct } from '@/types/app'
import { usePreferencesStore } from '@/stores/preferences'

interface FeaturedFabricsProps {
  products?: FeaturedProduct[]
  loading?: boolean
  fxRate?: number
  className?: string
}

function SkeletonCard() {
  return (
    <div className="clip-corner bg-card min-h-[340px] animate-pulse">
      <div className="px-5 pt-5 pb-2">
        <div className="h-4 w-3/4 bg-[#C8C4BC] rounded-sm" />
        <div className="mt-1.5 h-2.5 w-1/2 bg-[#C8C4BC] rounded-sm" />
      </div>
      <div className="mx-4 my-3 h-36 bg-[#D0CCC4]" />
      <div className="h-px bg-[#C8C4BC]" />
      <div className="p-5 space-y-2">
        <div className="h-2.5 w-full bg-[#C8C4BC] rounded-sm" />
        <div className="h-2.5 w-2/3 bg-[#C8C4BC] rounded-sm" />
      </div>
    </div>
  )
}

export function FeaturedFabrics({
  products = [],
  loading = false,
  fxRate = 278,
  className,
}: FeaturedFabricsProps) {
  const { currency, unit } = usePreferencesStore()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section className={cn('relative py-24 lg:py-32 overflow-hidden', className)}>
      {/* Subtle bg glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(232,89,60,0.06),transparent)]" />

      <div ref={ref} className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <div className="flex items-end justify-between gap-6 mb-14">
          <div>
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: 40 } : {}}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="h-px bg-accent mb-4 origin-left"
            />
            <motion.p
              initial={{ opacity: 0, x: -12 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-mono text-[9px] uppercase tracking-[0.28em] text-accent"
            >
              Curated Selection
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="mt-2 font-display text-4xl font-semibold tracking-tight text-text-primary lg:text-5xl"
            >
              Featured Fabrics
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.4 }}
          >
            <Link
              to="/marketplace"
              className="group hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-accent sm:inline-flex"
            >
              View all fabrics
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        {/* Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : products.slice(0, 4).map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.55, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <FabricCard
                  product={product}
                  variant="grid"
                  currency={currency}
                  unit={unit}
                  fxRate={fxRate}
                />
              </motion.div>
            ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-10 text-center sm:hidden">
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 border border-border px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-text-secondary hover:border-accent hover:text-accent transition-colors clip-corner-sm"
          >
            View all fabrics
          </Link>
        </div>
      </div>
    </section>
  )
}

export default FeaturedFabrics
