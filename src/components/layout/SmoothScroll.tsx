import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import { cn } from '@/lib/utils'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { setLenis } from '@/lib/lenis'

export interface SmoothScrollProps {
  children: ReactNode
  className?: string
}

/** Portals and auth screens are data UI -- smooth scrolling is cost with no benefit there. */
const NO_SMOOTH_SCROLL = /^\/(buyer|supplier-portal|admin|auth)/

export function SmoothScroll({ children, className }: SmoothScrollProps) {
  const { pathname } = useLocation()
  const enabled = !NO_SMOOTH_SCROLL.test(pathname)

  useEffect(() => {
    // Gate inside the effect rather than conditionally rendering <SmoothScroll>: this
    // component wraps <Routes>, so unmounting it on navigation would remount the entire
    // route tree. Creating and destroying Lenis on a zone change is cheap and rare.
    if (!enabled) {
      setLenis(null)
      return
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    setLenis(lenis)

    // Drive Lenis from GSAP's ticker so ScrollTrigger stays perfectly in sync.
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)

    // GSAP's defaults, deliberately restored. This used to be lagSmoothing(0), copied from
    // the Lenis+GSAP recipe, whose concern is that clamping `time` makes Lenis under-advance
    // after a stall. But with smoothing off, a 400ms stall makes GSAP advance every tween by
    // the full 400ms -- one long frame becomes a visible jump, which is exactly the "fine
    // locally, janky in production" report. Under-advancing is a slightly slower catch-up;
    // that is strictly better than a jump.
    gsap.ticker.lagSmoothing(500, 33)

    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
      setLenis(null)
    }
  }, [enabled])

  return <div className={cn('min-h-screen', className)}>{children}</div>
}

export default SmoothScroll
