import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowUpRight, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SupplierWithCount } from '@/types/app'

interface VendorsSectionProps {
  suppliers?: SupplierWithCount[]
  loading?: boolean
  className?: string
}

function SupplierCard({ supplier, index, inView }: { supplier: SupplierWithCount; index: number; inView: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.15 + index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        to={`/supplier/${supplier.slug}`}
        className="group relative flex flex-col clip-corner bg-card p-6 transition-all duration-300 hover:bg-card-hover"
      >
        {/* Corner accent triangle is handled by CSS */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-semibold text-text-dark transition-colors group-hover:text-accent leading-tight">
              {supplier.brand_name}
            </h3>
            {supplier.badge_label && (
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-text-dark-secondary">
                {supplier.badge_label}
              </p>
            )}
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-text-dark-secondary/60 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
        </div>

        <div className="mt-5 h-px bg-[#C8C4BC]" />

        <div className="mt-4 flex items-center justify-between">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-dark-secondary">
            {supplier.product_count ?? 0} fabrics
          </p>
          {supplier.is_verified && (
            <span className="font-mono text-[8px] uppercase tracking-widest text-accent">
              ✓ Verified
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

function SkeletonVendor() {
  return (
    <div className="clip-corner bg-card p-6 animate-pulse">
      <div className="h-4 w-2/3 bg-[#C8C4BC] rounded-sm" />
      <div className="mt-2 h-2.5 w-1/3 bg-[#C8C4BC] rounded-sm" />
      <div className="mt-5 h-px bg-[#C8C4BC]" />
      <div className="mt-4 h-2.5 w-1/4 bg-[#C8C4BC] rounded-sm" />
    </div>
  )
}

export function VendorsSection({ suppliers = [], loading = false, className }: VendorsSectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  const displaySuppliers = suppliers.slice(0, 6)

  return (
    <section className={cn('relative border-t border-border bg-surface py-24 lg:py-32 overflow-hidden', className)}>
      {/* Large background text watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
        <span
          className="font-display font-semibold text-text-primary/[0.025] whitespace-nowrap"
          style={{ fontSize: 'clamp(80px, 18vw, 240px)', letterSpacing: '-0.04em' }}
        >
          VENDORS
        </span>
      </div>

      <div ref={ref} className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mb-14 flex items-end justify-between gap-6">
          <div>
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: 40 } : {}}
              transition={{ duration: 0.6 }}
              className="h-px bg-accent mb-4 origin-left"
            />
            <motion.p
              initial={{ opacity: 0, x: -12 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-mono text-[9px] uppercase tracking-[0.28em] text-accent"
            >
              Supply Network
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="mt-2 font-display text-4xl font-semibold tracking-tight text-text-primary lg:text-5xl"
            >
              Verified Vendors
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.4 }}
          >
            <Link
              to="/vendors"
              className="group hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-accent sm:inline-flex"
            >
              View all vendors
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonVendor key={i} />)
            : displaySuppliers.map((supplier, i) => (
              <SupplierCard key={supplier.id} supplier={supplier} index={i} inView={inView} />
            ))}
        </div>
      </div>
    </section>
  )
}

export default VendorsSection
