import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { ArrowUpRight, Sparkles, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FeaturedProduct } from '@/types/app'
import { getProductImageUrl, formatPrice } from '@/lib/utils'
import { usePreferencesStore } from '@/stores/preferences'

interface CollageGridProps {
  products?: FeaturedProduct[]
  loading?: boolean
  fxRate?: number
  className?: string
}

function ProductCard({
  product,
  index,
  inView,
  currency,
  unit,
  fxRate,
  variant = 'default',
}: {
  product: FeaturedProduct
  index: number
  inView: boolean
  currency: 'PKR' | 'USD'
  unit: 'meters' | 'yards'
  fxRate: number
  variant?: 'default' | 'featured' | 'tall'
}) {
  const imageUrl = product.images[0]
    ? getProductImageUrl(product.images[0], {
        variant: variant === 'featured' ? 'medium' : 'card',
      })
    : undefined
  const priceMin = currency === 'USD' 
    ? (product.price_min_usd ?? (product.price_min_pkr ?? 0) / fxRate)
    : (product.price_min_pkr ?? 0)
  const displayPrice = priceMin

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: 0.15 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <Link
        to={`/fabric/${product.slug}`}
        className={cn(
          'group relative flex flex-col h-full overflow-hidden transition-all duration-300',
          variant === 'featured' 
            ? 'clip-corner-lg bg-elevated border border-border hover:border-accent/50' 
            : 'clip-corner bg-card border border-border-cream hover:bg-card-hover'
        )}
      >
        {/* Image */}
        <div className={cn(
          'relative overflow-hidden',
          variant === 'featured' ? 'flex-1 min-h-[280px]' : 
          variant === 'tall' ? 'flex-1 min-h-[240px]' : 'h-44'
        )}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className={cn(
              'h-full w-full flex items-center justify-center',
              variant === 'featured' ? 'bg-surface' : 'bg-[#D8D4CC]'
            )}>
                <svg className="w-16 h-16 opacity-20" viewBox="0 0 60 60">
                  <defs>
                    <pattern id={`fabric-${index}`} width="8" height="8" patternUnits="userSpaceOnUse">
                      <path d="M0 4h8M4 0v8" stroke="currentColor" strokeWidth="0.5" fill="none" />
                    </pattern>
                  </defs>
                  <rect width="60" height="60" fill={`url(#fabric-${index})`} />
                </svg>
            </div>
          )}

          {/* Gradient overlay */}
          <div className={cn(
            'absolute inset-0 transition-opacity duration-300',
            variant === 'featured' 
              ? 'bg-gradient-to-t from-black/70 via-black/20 to-transparent' 
              : 'bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100'
          )} />

          {/* Featured badge */}
          {product.is_featured && variant === 'featured' && (
            <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-accent px-3 py-1.5 clip-corner-sm">
              <Sparkles className="h-3 w-3 text-white" />
              <span className="font-mono text-[8px] uppercase tracking-widest text-white">
                Featured
              </span>
            </div>
          )}

          {/* Arrow indicator */}
          <div className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center bg-white/90 clip-corner-sm opacity-0 transition-all duration-300 group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4 text-text-dark" />
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          'p-5',
          variant === 'featured' ? 'bg-elevated' : ''
        )}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className={cn(
                'font-display text-base font-semibold leading-tight transition-colors group-hover:text-accent',
                variant === 'featured' ? 'text-text-primary' : 'text-text-dark'
              )}>
                {product.title}
              </h3>
              {product.supplier?.brand_name && (
                <p className={cn(
                  'mt-1 font-mono text-[9px] uppercase tracking-[0.16em]',
                  variant === 'featured' ? 'text-text-muted' : 'text-text-dark-secondary'
                )}>
                  {product.supplier.brand_name}
                </p>
              )}
            </div>
          </div>

          <div className={cn(
            'my-4 h-px',
            variant === 'featured' ? 'bg-border' : 'bg-border-cream'
          )} />

          <div className="flex items-center justify-between">
            <div>
              <p className={cn(
                'font-display text-lg font-semibold',
                variant === 'featured' ? 'text-text-primary' : 'text-text-dark'
              )}>
                {formatPrice(displayPrice, currency)}
              </p>
              <p className={cn(
                'font-mono text-[8px] uppercase tracking-widest',
                variant === 'featured' ? 'text-text-muted' : 'text-text-dark-secondary'
              )}>
                per {unit === 'meters' ? 'meter' : 'yard'}
              </p>
            </div>

            {product.stock_meters > 0 && (
              <span className="font-mono text-[8px] uppercase tracking-widest text-success">
                In Stock
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function SkeletonCard({ variant = 'default' }: { variant?: 'default' | 'featured' | 'tall' }) {
  return (
    <div className={cn(
      'animate-pulse overflow-hidden',
      variant === 'featured' 
        ? 'clip-corner-lg bg-elevated border border-border' 
        : 'clip-corner bg-card border border-border-cream'
    )}>
      <div className={cn(
        variant === 'featured' ? 'h-64' : variant === 'tall' ? 'h-52' : 'h-44',
        variant === 'featured' ? 'bg-surface' : 'bg-[#D0CCC4]'
      )} />
      <div className="p-5 space-y-3">
        <div className={cn(
          'h-4 w-3/4 rounded-sm',
          variant === 'featured' ? 'bg-border' : 'bg-[#C8C4BC]'
        )} />
        <div className={cn(
          'h-2.5 w-1/2 rounded-sm',
          variant === 'featured' ? 'bg-border' : 'bg-[#C8C4BC]'
        )} />
        <div className={cn(
          'h-px',
          variant === 'featured' ? 'bg-border' : 'bg-[#C8C4BC]'
        )} />
        <div className={cn(
          'h-5 w-1/3 rounded-sm',
          variant === 'featured' ? 'bg-border' : 'bg-[#C8C4BC]'
        )} />
      </div>
    </div>
  )
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  index, 
  inView 
}: { 
  icon: typeof Shield
  title: string
  description: string
  index: number
  inView: boolean 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
      className="group flex flex-col p-6 bg-elevated border border-border clip-corner transition-all duration-300 hover:border-accent/40"
    >
      <div className="flex h-10 w-10 items-center justify-center border border-border bg-surface clip-corner-sm transition-all duration-300 group-hover:bg-accent group-hover:border-accent">
        <Icon className="h-5 w-5 text-text-muted transition-colors group-hover:text-white" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-text-primary">
        {title}
      </h3>
      <p className="mt-2 text-sm text-text-secondary leading-relaxed">
        {description}
      </p>
    </motion.div>
  )
}

export function CollageGrid({
  products = [],
  loading = false,
  fxRate = 278,
  className,
}: CollageGridProps) {
  const { currency, unit } = usePreferencesStore()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })
  const y1 = useTransform(scrollYProgress, [0, 1], ['0%', '-5%'])
  const y2 = useTransform(scrollYProgress, [0, 1], ['0%', '5%'])

  const displayProducts = products.slice(0, 4)

  return (
    <section
      ref={containerRef}
      className={cn('relative overflow-hidden bg-background py-24 lg:py-32', className)}
    >
      {/* Background elements */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_40%_20%,rgba(232,89,60,0.06),transparent)]" />
      <div className="absolute inset-0 grid-overlay opacity-20" />

      {/* Large background text */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
        <span
          className="font-display font-bold text-text-primary/[0.015] whitespace-nowrap"
          style={{ fontSize: 'clamp(100px, 20vw, 280px)', letterSpacing: '-0.05em' }}
        >
          FABRICS
        </span>
      </div>

      <div ref={ref} className="relative mx-auto max-w-[1400px] px-4 lg:px-8">
        {/* Section header */}
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
              Curated Collection
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
              View all
              <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </motion.div>
        </div>

        {/* Collage grid */}
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
          {/* Featured large card */}
          <motion.div style={{ y: y1 }} className="lg:col-span-5 lg:row-span-2">
            {loading ? (
              <SkeletonCard variant="featured" />
            ) : displayProducts[0] ? (
              <ProductCard
                product={displayProducts[0]}
                index={0}
                inView={inView}
                currency={currency}
                unit={unit}
                fxRate={fxRate}
                variant="featured"
              />
            ) : null}
          </motion.div>

          {/* Right column cards */}
          <motion.div style={{ y: y2 }} className="lg:col-span-7 grid gap-4 sm:grid-cols-2 lg:gap-5">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              displayProducts.slice(1, 4).map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={i + 1}
                  inView={inView}
                  currency={currency}
                  unit={unit}
                  fxRate={fxRate}
                />
              ))
            )}

            {/* CTA card for remaining space */}
            {!loading && displayProducts.length < 4 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <Link
                  to="/marketplace"
                  className="group flex h-full min-h-[200px] flex-col items-center justify-center border border-dashed border-border bg-elevated/50 p-6 clip-corner transition-all duration-300 hover:border-accent hover:bg-elevated"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface transition-all duration-300 group-hover:bg-accent group-hover:border-accent">
                    <ArrowUpRight className="h-5 w-5 text-text-muted transition-colors group-hover:text-white" />
                  </div>
                  <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-text-secondary group-hover:text-accent transition-colors">
                    View All Fabrics
                  </p>
                </Link>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Feature cards row */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Shield, title: 'Verified Quality', description: 'Every fabric is authenticated and quality-checked by our team.' },
            { icon: Sparkles, title: '3D Visualization', description: 'Inspect weave patterns and textures in immersive 3D before ordering.' },
            { icon: Zap, title: 'Fast Response', description: 'Connect directly with suppliers and get quotes within hours.' },
          ].map((feature, i) => (
            <FeatureCard key={feature.title} {...feature} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default CollageGrid
