import { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'

interface CollageCardsProps {
  className?: string
}

export function CollageCards({ className }: CollageCardsProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section ref={ref} className={cn('bg-[#F6F1E9]', className)}>
      {/* Edge-to-edge grid with minimal gap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-1">
        
        {/* Buy Fabrics - Large left card */}
        <Link
          to="/marketplace"
          className="group relative lg:col-span-5 lg:row-span-2 min-h-[400px] lg:min-h-[700px] overflow-hidden"
        >
          {/* Background — warm chocolate */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#3A2518] via-[#261610] to-[#150D08]">
            {/* Fabric texture pattern */}
            <div className="absolute inset-0 opacity-25">
              <svg className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <pattern id="fabric-texture-1" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M0 20h40M20 0v40" stroke="rgba(232,89,60,0.2)" strokeWidth="0.5" fill="none" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#fabric-texture-1)" />
              </svg>
            </div>
            {/* Warm glow */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-[#E8593C]/15 rounded-full blur-[120px]" />
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-accent/0 group-hover:bg-accent/8 transition-colors duration-500" />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView && mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="absolute inset-0 flex flex-col justify-end p-8 lg:p-10"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#E8A070] mb-3">
              For Buyers
            </p>
            <h2 className="font-display text-4xl lg:text-5xl font-bold text-[#F5EDE4] tracking-tight mb-4">
              Buy Fabrics
            </h2>
            <p className="max-w-sm text-[#C8B8A8]/70 text-sm leading-relaxed mb-6">
              Browse 200+ verified fabric SKUs with detailed specs, 3D previews, and direct supplier access.
            </p>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#C8B8A8]/60 group-hover:text-[#E8A070] transition-colors">
              Browse Marketplace
              <motion.span
                className="inline-block"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </div>
          </motion.div>
        </Link>

        {/* Sell Fabrics - Top right card */}
        <Link
          to="/sell"
          className="group relative lg:col-span-7 min-h-[300px] lg:min-h-[346px] overflow-hidden"
        >
          {/* Background — warm sand/taupe */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#C8B89C] via-[#B0A084] to-[#9A8C70]">
            <div className="absolute inset-0 opacity-30">
              <svg className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <pattern id="fabric-texture-2" width="30" height="30" patternUnits="userSpaceOnUse">
                    <circle cx="15" cy="15" r="1" fill="rgba(60,40,20,0.25)" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#fabric-texture-2)" />
              </svg>
            </div>
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView && mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="absolute inset-0 flex flex-col justify-end p-8 lg:p-10"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6B3D20] mb-3">
              For Suppliers
            </p>
            <h2 className="font-display text-3xl lg:text-4xl font-bold text-[#2C1A0E] tracking-tight mb-3">
              Sell Fabrics
            </h2>
            <p className="max-w-md text-[#3C2A1A]/60 text-sm leading-relaxed mb-4">
              List your surplus inventory, get 3D scans, reach verified global buyers.
            </p>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#3C2A1A]/50 group-hover:text-[#6B3D20] transition-colors">
              Join as Supplier
              <motion.span
                className="inline-block"
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </div>
          </motion.div>
        </Link>

        {/* Bottom right - Two cards side by side */}
        <Link
          to="/vendors"
          className="group relative lg:col-span-4 min-h-[250px] lg:min-h-[346px] overflow-hidden"
        >
          {/* Background — warm ecru */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#E8DFD0] via-[#D4C8B4] to-[#BFAF98]">
            <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-[#E8593C]/10 rounded-full blur-[80px]" />
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-500" />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView && mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="absolute inset-0 flex flex-col justify-end p-8"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#7A4A28] mb-2">
              Network
            </p>
            <h3 className="font-display text-2xl font-bold text-[#2C1A0E] tracking-tight mb-2">
              Vendors
            </h3>
            <p className="text-[#3C2A1A]/50 text-sm">8+ verified suppliers</p>
          </motion.div>
        </Link>

        <Link
          to="/marketplace"
          className="group relative lg:col-span-3 min-h-[250px] lg:min-h-[346px] overflow-hidden"
        >
          {/* Background — warm linen with amber tint */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#D8CCBA] via-[#C4B8A0] to-[#AEA488]">
            {/* Animated fabric layers preview */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{ rotateY: [0, 10, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="w-24 h-32 opacity-30"
                style={{ transformStyle: 'preserve-3d', perspective: '500px' }}
              >
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="absolute inset-0 border border-[#6B3D20]/40 rounded"
                    style={{ transform: `translateZ(${i * 8}px) rotateX(60deg)` }}
                  />
                ))}
              </motion.div>
            </div>
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors duration-500" />

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={inView && mounted ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="absolute inset-0 flex flex-col justify-end p-8"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#7A4A28] mb-2">
              Technology
            </p>
            <h3 className="font-display text-2xl font-bold text-[#2C1A0E] tracking-tight mb-2">
              3D Vizu
            </h3>
            <p className="text-[#3C2A1A]/50 text-sm">Inspect in 3D</p>
          </motion.div>
        </Link>
      </div>
    </section>
  )
}

export default CollageCards
