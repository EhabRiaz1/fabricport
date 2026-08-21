import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { BannerImage, bannerPosterSrc } from '@/components/shared/BannerImage'
import { useBackgroundVideo } from '@/hooks/useBackgroundVideo'

/** Eased count-up that starts once the target becomes known. */
function useCountUp(target: number, duration = 1600): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!target) return
    let raf: number
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function formatMeters(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`
  return value.toLocaleString()
}

function HeroStat({
  value,
  label,
  format,
}: {
  value: number
  label: string
  format?: (n: number) => string
}) {
  const animated = useCountUp(value)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-display text-2xl font-bold tabular-nums tracking-tight text-[#F5EDE4] sm:text-3xl">
        {format ? format(animated) : animated.toLocaleString()}
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-[#F5EDE4]/45">
        {label}
      </span>
    </div>
  )
}

export interface ArchiveHeroProps {
  totalFabrics: number
  totalMills: number
  totalMeters: number
  videoSrc?: string
}

/**
 * Full-bleed "living texture" hero: slow fabric video, oversized display
 * title, count-up inventory stats. Content parallaxes away as the catalogue
 * scrolls in underneath.
 */
export function ArchiveHero({
  totalFabrics,
  totalMills,
  totalMeters,
  videoSrc = '/hero-fabric.mp4',
}: ArchiveHeroProps) {
  const containerRef = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const prefersReducedMotion = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 120])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
  const mediaScale = useTransform(scrollYProgress, [0, 1], [1.02, 1.14])

  useBackgroundVideo(videoRef, containerRef, { playbackRate: 0.6 })

  return (
    <section
      ref={containerRef}
      className="grain relative flex min-h-[68vh] flex-col justify-end overflow-hidden bg-[#1A0E06] pt-[60px]"
    >
      <motion.div
        className="absolute inset-0"
        style={prefersReducedMotion ? undefined : { scale: mediaScale }}
      >
        {prefersReducedMotion ? (
          <BannerImage className="absolute inset-0" />
        ) : (
          /*
           * preload="none", not "metadata": the source file is 10 MB and useBackgroundVideo
           * only pauses PLAYBACK off-screen -- the browser still fetches it. The AVIF poster
           * carries the first paint instead.
           */
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            preload="none"
            disableRemotePlayback
            poster={bannerPosterSrc}
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        )}
        <div className="absolute inset-0 bg-[#1A0E06]/55" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(26,14,6,0.92) 0%, rgba(26,14,6,0.25) 45%, rgba(26,14,6,0.45) 100%)',
          }}
        />
      </motion.div>

      <motion.div
        className="relative mx-auto w-full max-w-[1600px] px-6 pb-14 pt-28 sm:px-10 sm:pb-16 lg:px-14 xl:px-20"
        style={prefersReducedMotion ? undefined : { y: contentY, opacity: contentOpacity }}
      >
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#E8A070]"
        >
          Marketplace — Verified surplus
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 font-display font-bold tracking-tight text-[#F5EDE4]"
          style={{ fontSize: 'clamp(44px, 7.5vw, 110px)', lineHeight: 0.95 }}
        >
          The Archive
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 max-w-xl text-sm leading-relaxed text-[#F5EDE4]/65 sm:text-base"
        >
          Deadstock and surplus rolls from Pakistan's leading mills — scanned,
          spec'd and ready to ship. Every metre verified in-house.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex items-center gap-10 border-t border-[#F5EDE4]/12 pt-6 sm:gap-16"
        >
          <HeroStat value={totalFabrics} label="Fabrics live" />
          <HeroStat value={totalMills} label="Verified mills" />
          <HeroStat value={totalMeters} label="Metres in stock" format={formatMeters} />
        </motion.div>
      </motion.div>

      {/* Bottom hairline that hands off to the cream catalogue */}
      <div className="relative h-px w-full bg-[#E8A070]/40" aria-hidden />
    </section>
  )
}

export default ArchiveHero
