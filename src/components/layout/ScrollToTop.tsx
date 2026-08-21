import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { getLenis } from '@/lib/lenis'

/**
 * Puts every navigation at the top of the page. Renders nothing.
 *
 * Nothing did this before, so opening a fabric from halfway down the marketplace landed you
 * halfway down the detail page. Two things conspire: the browser restores the previous
 * document scroll position on a history entry, and Lenis keeps its own internal target which
 * knows nothing about that restore, so even scrolling manually felt like it started from the
 * wrong place.
 *
 * `history.scrollRestoration = 'manual'` stops the browser guessing; POP navigations (back /
 * forward) are left alone so returning to the marketplace keeps your place in the grid.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    if (navigationType === 'POP') return

    const lenis = getLenis()
    if (lenis) {
      // immediate: this is a page change, not a scroll gesture -- animating to the top would
      // show the new page sliding, and would fight the entry animations.
      lenis.scrollTo(0, { immediate: true, force: true })
    }
    window.scrollTo(0, 0)
  }, [pathname, navigationType])

  return null
}

export default ScrollToTop
