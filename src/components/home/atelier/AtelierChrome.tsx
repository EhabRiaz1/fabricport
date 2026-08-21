import { useEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from '@/lib/gsap'

/**
 * Page-level micro-details for the home page: the woven curtain intro,
 * a thread progress line down the left edge, and a contextual cursor dot
 * (pointer-fine devices only).
 */
export function AtelierChrome() {
  const [showCurtain, setShowCurtain] = useState(() => {
    if (typeof window === 'undefined') return false
    if (prefersReducedMotion()) return false
    return !sessionStorage.getItem('fp-intro-seen')
  })
  const curtainRef = useRef<HTMLDivElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)

  // Curtain intro — once per session
  useEffect(() => {
    if (!showCurtain) return
    const curtain = curtainRef.current
    if (!curtain) return

    sessionStorage.setItem('fp-intro-seen', '1')
    document.documentElement.style.overflow = 'hidden'

    const tl = gsap.timeline({
      onComplete: () => {
        document.documentElement.style.overflow = ''
        setShowCurtain(false)
      },
    })

    tl.fromTo(
      curtain.querySelectorAll('[data-thread]'),
      { scaleX: 0 },
      { scaleX: 1, duration: 0.5, stagger: 0.06, ease: 'power2.inOut', transformOrigin: 'left' },
    )
      .fromTo(
        curtain.querySelector('[data-curtain-mark]'),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4 },
        '-=0.3',
      )
      .to(curtain, {
        clipPath: 'inset(0 0 100% 0)',
        duration: 0.8,
        delay: 0.25,
        ease: 'power4.inOut',
      })

    return () => {
      tl.kill()
      document.documentElement.style.overflow = ''
    }
  }, [showCurtain])

  // Thread progress line
  useEffect(() => {
    const thread = threadRef.current
    if (!thread || prefersReducedMotion()) return

    const trigger = gsap.fromTo(
      thread,
      { scaleY: 0 },
      {
        scaleY: 1,
        transformOrigin: 'top',
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: 0.4 },
      },
    )
    return () => {
      trigger.scrollTrigger?.kill()
      trigger.kill()
    }
  }, [])

  // Contextual cursor dot
  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor) return
    if (!window.matchMedia('(pointer: fine)').matches || prefersReducedMotion()) {
      cursor.style.display = 'none'
      return
    }

    const setX = gsap.quickTo(cursor, 'x', { duration: 0.22, ease: 'power3.out' })
    const setY = gsap.quickTo(cursor, 'y', { duration: 0.22, ease: 'power3.out' })

    function onMove(event: MouseEvent) {
      setX(event.clientX)
      setY(event.clientY)
    }

    // Hover state via pointerover/pointerout delegation rather than a closest('a, button')
    // walk on every mousemove. Boundary events fire only when the hovered element actually
    // changes, so the DOM traversal goes from ~60x/second to a handful of times per second.
    function onOver(event: PointerEvent) {
      if ((event.target as HTMLElement).closest('a, button')) cursor!.dataset.state = 'hover'
    }
    function onOut(event: PointerEvent) {
      if ((event.target as HTMLElement).closest('a, button')) cursor!.dataset.state = 'idle'
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('pointerout', onOut, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
    }
  }, [])

  return (
    <>
      {/* Thread progress line */}
      <div className="pointer-events-none fixed inset-y-0 left-3 z-[60] hidden w-px lg:block">
        <div ref={threadRef} className="h-full w-full bg-gradient-to-b from-accent via-bronze to-accent" />
      </div>

      {/* Cursor dot */}
      <div
        ref={cursorRef}
        aria-hidden
        // No mix-blend-difference. A blend mode on a fixed, always-moving element forces
        // everything painted beneath it into a single non-composited raster group, which is
        // re-rendered on every frame the dot moves. A solid accent ring reads correctly on
        // both the dark hero and the cream body.
        className="pointer-events-none fixed left-0 top-0 z-[70] -ml-1.5 -mt-1.5 hidden h-3 w-3 rounded-full border border-accent bg-accent/25 transition-transform duration-200 will-change-transform data-[state=hover]:scale-[2.2] lg:block"
      />

      {/* Curtain intro */}
      {showCurtain && (
        <div
          ref={curtainRef}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-1.5 bg-[#1A0E06]"
          style={{ clipPath: 'inset(0 0 0% 0)' }}
        >
          <div className="flex w-48 flex-col gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <span
                key={i}
                data-thread
                className="block h-px w-full bg-gradient-to-r from-transparent via-[#E8A070] to-transparent"
              />
            ))}
          </div>
          <p
            data-curtain-mark
            className="mt-6 font-mono text-[10px] uppercase tracking-[0.4em] text-[#E8A070]"
          >
            FabricPort
          </p>
        </div>
      )}
    </>
  )
}

export default AtelierChrome
