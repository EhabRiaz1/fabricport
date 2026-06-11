import { useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { useBackgroundVideo } from '@/hooks/useBackgroundVideo'

interface CollageHeroProps {
  className?: string
  videoSrc?: string
}

export function CollageHero({ className, videoSrc = '/hero-fabric.mp4' }: CollageHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [mounted, setMounted] = useState(false)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1])

  useBackgroundVideo(videoRef, containerRef, { playbackRate: 0.75 })

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <section
      ref={containerRef}
      className={cn('relative min-h-screen bg-[#1A0E06] overflow-hidden', className)}
    >
      {/* Full-screen video background */}
      <motion.div
        style={{ scale }}
        className="absolute inset-0"
      >
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="metadata"
          disableRemotePlayback
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
        {/* Overlay — warm amber tint keeps text readable while softening the mood */}
        <div className="absolute inset-0 bg-[#1A0E06]/45" />
        {/* Gradient overlay for depth */}
        <div 
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(180deg, rgba(20,10,4,0.25) 0%, rgba(10,5,2,0.05) 40%, rgba(20,10,4,0.65) 100%),
              radial-gradient(ellipse 80% 80% at 50% 50%, transparent 0%, rgba(20,10,4,0.35) 100%)
            `,
          }}
        />
      </motion.div>

      {/* Minimal nav */}
      <motion.div
        style={{ opacity }}
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-6 lg:p-8"
      >
        <BrandLogo />
        <div className="flex items-center gap-8">
          <Link to="/marketplace" className="hidden sm:block font-mono text-[11px] uppercase tracking-widest text-white/60 hover:text-white transition-colors">
            Marketplace
          </Link>
          <Link to="/vendors" className="hidden sm:block font-mono text-[11px] uppercase tracking-widest text-white/60 hover:text-white transition-colors">
            Vendors
          </Link>
          <Link 
            to="/auth/login"
            className="font-mono text-[11px] uppercase tracking-widest text-white/80 hover:text-white transition-colors"
          >
            Sign In
          </Link>
        </div>
      </motion.div>

      {/* Main headline - centered */}
      <motion.div
        style={{ opacity }}
        className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent mb-8"
        >
          B2B Fabric Marketplace
        </motion.p>

        <div className="overflow-hidden">
          <motion.h1
            initial={{ y: '100%' }}
            animate={mounted ? { y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="font-display font-bold text-white leading-[0.9] tracking-[-0.04em]"
            style={{ fontSize: 'clamp(48px, 10vw, 140px)' }}
          >
            PAKISTAN'S
          </motion.h1>
        </div>
        <div className="overflow-hidden">
          <motion.h1
            initial={{ y: '100%' }}
            animate={mounted ? { y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="font-display font-bold text-white leading-[0.9] tracking-[-0.04em]"
            style={{ fontSize: 'clamp(48px, 10vw, 140px)' }}
          >
            PREMIER FABRIC
          </motion.h1>
        </div>
        <div className="overflow-hidden">
          <motion.h1
            initial={{ y: '100%' }}
            animate={mounted ? { y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="font-display font-bold text-white leading-[0.9] tracking-[-0.04em]"
            style={{ fontSize: 'clamp(48px, 10vw, 140px)' }}
          >
            EXCHANGE
          </motion.h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={mounted ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-2 bg-white px-8 py-4 font-mono text-[11px] uppercase tracking-widest text-[#0a0a0a] transition-colors hover:bg-white/90"
          >
            Buy Fabrics
          </Link>
          <Link
            to="/sell"
            className="inline-flex items-center gap-2 border border-white/25 px-8 py-4 font-mono text-[11px] uppercase tracking-widest text-white/80 transition-colors hover:border-white/50 hover:text-white"
          >
            Sell Fabrics
          </Link>
        </motion.div>

        {/* Bottom meta info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={mounted ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="absolute bottom-8 left-0 right-0 px-6 lg:px-8 flex items-end justify-between"
        >
          <div className="flex items-center gap-6">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              Est. 2024
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              Lahore
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-white/40">
              Verified Suppliers
            </span>
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowUpRight className="w-4 h-4 text-white/40 rotate-90" />
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

export default CollageHero
