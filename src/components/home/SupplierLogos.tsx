import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SupplierLogo {
  name: string
  logo?: string
}

interface SupplierLogosProps {
  suppliers?: SupplierLogo[]
  className?: string
}

const DEFAULT_SUPPLIERS: SupplierLogo[] = [
  { name: 'Al-Karam Textile' },
  { name: 'Gul Ahmed' },
  { name: 'Nishat Mills' },
  { name: 'Sapphire' },
  { name: 'Khaadi' },
  { name: 'Sana Safinaz' },
  { name: 'Bonanza' },
  { name: 'J.' },
]

export function SupplierLogos({ suppliers = DEFAULT_SUPPLIERS, className }: SupplierLogosProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  const duplicatedSuppliers = [...suppliers, ...suppliers]

  return (
    <section
      ref={ref}
      className={cn('relative bg-[#F6F1E9] py-16 lg:py-20 overflow-hidden', className)}
    >
      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-32 bg-gradient-to-r from-[#F6F1E9] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-32 bg-gradient-to-l from-[#F6F1E9] to-transparent" />

      {/* Marquee */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6 }}
        className="marquee-track flex items-center gap-16 lg:gap-24"
      >
        {duplicatedSuppliers.map((supplier, i) => (
          <div
            key={`${supplier.name}-${i}`}
            className="flex-shrink-0"
          >
            {supplier.logo ? (
              <img
                src={supplier.logo}
                alt={supplier.name}
                className="h-8 lg:h-10 object-contain opacity-40 grayscale hover:opacity-80 hover:grayscale-0 transition-all duration-300"
              />
            ) : (
              <span className="font-display text-xl lg:text-2xl font-semibold text-[#3C2A1A]/30 whitespace-nowrap hover:text-[#3C2A1A]/60 transition-colors duration-300">
                {supplier.name}
              </span>
            )}
          </div>
        ))}
      </motion.div>
    </section>
  )
}

export default SupplierLogos
