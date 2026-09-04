import { useEffect, useRef } from 'react'
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
 *
 * The scroll fires on a real *pathname* change only, tracked through a ref. It used to key
 * off `[pathname, navigationType]`, and that is what threw the marketplace to the top the
 * first time you touched a filter: the initial render's navigation type is POP, and the
 * first `setSearchParams(..., { replace: true })` from `useMarketplaceFilters` flips it to
 * REPLACE. Same pathname, changed dependency, effect re-runs, page jumps. Every later
 * filter change kept REPLACE, which is why it only ever misbehaved once per visit.
 * `navigationType` is still read for the POP guard; it is simply no longer a trigger.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()
  const lastPathname = useRef<string | null>(null)

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useEffect(() => {
    if (lastPathname.current === pathname) return
    lastPathname.current = pathname

    if (navigationType === 'POP') return

    const lenis = getLenis()
    if (lenis) {
      // immediate: this is a page change, not a scroll gesture -- animating to the top would
      // show the new page sliding, and would fight the entry animations.
      lenis.scrollTo(0, { immediate: true, force: true })
    }
    window.scrollTo(0, 0)
    // navigationType is read, not depended on -- see the note above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}

export default ScrollToTop
