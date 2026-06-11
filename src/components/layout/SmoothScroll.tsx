import { useEffect, useRef, type ReactNode } from 'react'
import Lenis from 'lenis'
import { cn } from '@/lib/utils'
import { gsap, ScrollTrigger } from '@/lib/gsap'

export interface SmoothScrollProps {
  children: ReactNode
  className?: string
}

export function SmoothScroll({ children, className }: SmoothScrollProps) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    lenisRef.current = lenis

    // Drive Lenis from GSAP's ticker so ScrollTrigger stays perfectly in sync.
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return <div className={cn('min-h-screen', className)}>{children}</div>
}

export default SmoothScroll
