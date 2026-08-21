import { useEffect } from 'react'
import type Lenis from 'lenis'

/**
 * Module-level handle on the single Lenis instance owned by `SmoothScroll`.
 *
 * Lenis intercepts wheel events globally, so anything that opens over the page -- a sheet,
 * the cart drawer, the chat panel -- has to be able to pause it. Radix's `react-remove-scroll`
 * locks the *body*, but Lenis keeps its own scroll target and will resume mid-animation on
 * close, producing a one-frame jump. Stopping it explicitly avoids that.
 *
 * A module-level variable rather than context: `SmoothScroll` sits above the router, and the
 * consumers are scattered leaf components that would otherwise all need a provider.
 */
let instance: Lenis | null = null

export function setLenis(next: Lenis | null): void {
  instance = next
}

export function getLenis(): Lenis | null {
  return instance
}

/**
 * Pauses smooth scrolling while an overlay is open.
 *
 * Also covers the case where Lenis is created *after* the overlay opens (a zone change
 * remounts it), because the effect re-runs on `open` and a null instance is simply a no-op.
 */
export function useLenisLock(open: boolean): void {
  useEffect(() => {
    if (!open) return
    const lenis = getLenis()
    lenis?.stop()
    return () => {
      lenis?.start()
    }
  }, [open])
}
