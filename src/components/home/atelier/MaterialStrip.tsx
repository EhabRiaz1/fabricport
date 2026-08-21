import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { prefersReducedMotion } from '@/lib/gsap'
import { getProductImageUrl } from '@/lib/utils'
import type { ProductWithRelations } from '@/types/app'

export interface MaterialStripProps {
  products: ProductWithRelations[]
}

function getSpec(product: ProductWithRelations, slug: string): string | null {
  const match = product.attributes?.find((attr) => attr.attribute?.slug === slug)
  if (!match) return null
  return match.value_text ?? (match.value_number != null ? String(match.value_number) : null)
}

const HINT_KEY = 'fp-rack-hint'
/** Beyond this much pointer travel a release is a drag, not a click on a tile. */
const DRAG_SLOP_PX = 6

/**
 * Horizontal material rack.
 *
 * The rack and its velocity-reactive slant are the point of this section and are unchanged.
 * What is gone is the vertical-scroll hijack: this used to be a 280vh-tall section with a
 * sticky inner frame and a scrubbed GSAP tween translating the track, so scrolling down the
 * page walked the rack sideways and the reader could not simply move past it. It is now a
 * normal-height section containing a native horizontal scroller, with arrows, drag-to-pan
 * and keyboard control, and vertical scroll passes straight through.
 *
 * The skew is now driven by the rack's OWN horizontal velocity rather than page velocity,
 * and it is applied as a single `skewX()` on the track element. Previously every frame wrote
 * a `--strip-skew` custom property that all nine tiles read in their inline transform, which
 * invalidated style for the whole subtree on every scroll event -- the most expensive thing
 * on the home page. Skewing the shared parent shears the children identically for one write.
 */
export function MaterialStrip({ products }: MaterialStripProps) {
  const rackRef = useRef<HTMLDivElement>(null)
  const skewRef = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const [interacted, setInteracted] = useState(false)

  // --- edge state ------------------------------------------------------------------
  const syncEdges = useCallback(() => {
    const rack = rackRef.current
    if (!rack) return
    const max = rack.scrollWidth - rack.clientWidth
    setAtStart(rack.scrollLeft <= 1)
    setAtEnd(rack.scrollLeft >= max - 1)
  }, [])

  useEffect(() => {
    const rack = rackRef.current
    if (!rack) return
    syncEdges()
    const observer = new ResizeObserver(syncEdges)
    observer.observe(rack)
    return () => observer.disconnect()
  }, [syncEdges, products.length])

  // --- velocity-reactive skew ------------------------------------------------------
  useEffect(() => {
    const rack = rackRef.current
    const skewEl = skewRef.current
    if (!rack || !skewEl || products.length === 0) return
    if (prefersReducedMotion()) return

    let lastLeft = rack.scrollLeft
    let lastTime = performance.now()
    let velocity = 0
    let skew = 0
    let raf = 0

    const clamp = (v: number) => Math.max(-6, Math.min(6, v))

    const loop = () => {
      // Ease toward the velocity-derived target, then back to rest. One style write per
      // frame, on one element.
      const target = clamp(velocity * -0.02)
      skew += (target - skew) * 0.12
      velocity *= 0.9
      skewEl.style.transform = `skewX(${skew.toFixed(2)}deg)`

      if (Math.abs(skew) < 0.02 && Math.abs(velocity) < 0.5) {
        skewEl.style.transform = 'skewX(0deg)'
        raf = 0
        return
      }
      raf = requestAnimationFrame(loop)
    }

    // The listener only records numbers into locals -- no DOM reads, no DOM writes.
    const onScroll = () => {
      const now = performance.now()
      const dt = now - lastTime
      if (dt > 0) velocity = ((rack.scrollLeft - lastLeft) / dt) * 16.67
      lastLeft = rack.scrollLeft
      lastTime = now
      syncEdges()
      if (!raf) raf = requestAnimationFrame(loop)
    }

    rack.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      rack.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [products.length, syncEdges])

  // --- one-time nudge hint ---------------------------------------------------------
  useEffect(() => {
    const rack = rackRef.current
    if (!rack || products.length === 0) return
    if (prefersReducedMotion()) return
    if (sessionStorage.getItem(HINT_KEY) === '1') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        sessionStorage.setItem(HINT_KEY, '1')

        // A hand-rolled ease rather than two chained scrollBy({behavior:'smooth'}) calls,
        // which queue against each other and land somewhere unintended.
        const start = performance.now()
        const nudge = (now: number) => {
          const t = Math.min((now - start) / 700, 1)
          rack.scrollLeft = Math.sin(t * Math.PI) * 28
          if (t < 1) requestAnimationFrame(nudge)
        }
        requestAnimationFrame(nudge)
      },
      { threshold: 0.4 },
    )
    observer.observe(rack)
    return () => observer.disconnect()
  }, [products.length])

  // --- arrows / keyboard -----------------------------------------------------------
  const step = useCallback((direction: 1 | -1) => {
    const rack = rackRef.current
    if (!rack) return
    setInteracted(true)
    const tile = rack.querySelector<HTMLElement>('[data-rack-tile]')
    const distance = (tile?.offsetWidth ?? rack.clientWidth * 0.6) + 24
    rack.scrollBy({
      left: direction * distance,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [])

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const rack = rackRef.current
    if (!rack) return
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1) }
    else if (event.key === 'Home') { event.preventDefault(); rack.scrollTo({ left: 0 }) }
    else if (event.key === 'End') {
      event.preventDefault()
      rack.scrollTo({ left: rack.scrollWidth })
    }
  }

  // --- drag to pan (mouse only; touch already pans natively with momentum) ----------
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false })

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    const rack = rackRef.current
    if (!rack) return
    drag.current = { active: true, startX: event.clientX, startLeft: rack.scrollLeft, moved: false }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rack = rackRef.current
    if (!drag.current.active || !rack) return
    const dx = event.clientX - drag.current.startX
    if (Math.abs(dx) > DRAG_SLOP_PX) {
      drag.current.moved = true
      setInteracted(true)
    }
    rack.scrollLeft = drag.current.startLeft - dx
  }

  const endDrag = () => {
    drag.current.active = false
  }

  // Capture phase: a drag that ends over a tile must not navigate.
  const onClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!drag.current.moved) return
    event.preventDefault()
    event.stopPropagation()
    drag.current.moved = false
  }

  if (products.length === 0) return null

  return (
    <section className="relative overflow-hidden bg-background py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-6 pb-10 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">
              The material library
            </p>
            <h2
              className="mt-3 font-display font-bold tracking-tight text-text-primary"
              style={{ fontSize: 'clamp(30px, 4.5vw, 56px)', lineHeight: 1 }}
            >
              Walk the racks
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`hidden font-mono text-[10px] uppercase tracking-[0.24em] text-text-muted transition-opacity duration-500 sm:block ${
                interacted ? 'opacity-0' : 'opacity-100'
              }`}
            >
              Drag or scroll →
            </span>
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={atStart}
              aria-label="Previous fabrics"
              className="clip-corner-sm grid h-11 w-11 place-items-center border border-border-strong text-ink transition-colors hover:bg-elevated disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={atEnd}
              aria-label="More fabrics"
              className="clip-corner-sm grid h-11 w-11 place-items-center border border-border-strong text-ink transition-colors hover:bg-elevated disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Edge fades. Driven by boolean state, so they repaint on crossing an edge, not per frame. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent transition-opacity duration-300 ${
            atStart ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent transition-opacity duration-300 ${
            atEnd ? 'opacity-0' : 'opacity-100'
          }`}
        />

        <div
          ref={rackRef}
          tabIndex={0}
          role="region"
          aria-label="Material library"
          // data-lenis-prevent is required: Lenis intercepts wheel events document-wide, so
          // without it a trackpad swipe never reaches this scroller.
          data-lenis-prevent
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClickCapture={onClickCapture}
          className="scrollbar-none overflow-x-auto overscroll-x-contain focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <div ref={skewRef} className="flex w-max gap-6 pl-6 pr-[20vw] will-change-transform lg:pl-8">
            {products.map((product, index) => {
              const image = product.images[0]
                ? getProductImageUrl(product.images[0], { variant: 'medium' })
                : null
              const gsm = getSpec(product, 'weight-before-wash') ?? getSpec(product, 'gsm')
              const width = getSpec(product, 'width-inches') ?? getSpec(product, 'width')

              return (
                <Link
                  key={product.id}
                  to={`/fabric/${product.slug}`}
                  data-rack-tile
                  className="group relative block w-[68vw] shrink-0 sm:w-[44vw] lg:w-[30vw]"
                >
                  <div className="clip-corner relative aspect-[4/5] overflow-hidden bg-elevated">
                    {image && (
                      <img
                        src={image}
                        alt={product.title}
                        loading={index < 3 ? 'eager' : 'lazy'}
                        draggable={false}
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E06]/70 via-transparent to-transparent opacity-80" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg font-semibold tracking-tight text-[#F5EDE4]">
                          {product.title}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.2em] text-[#F5EDE4]/55">
                          {product.supplier?.brand_name}
                        </p>
                      </div>
                      {product.color_hex && (
                        <span
                          className="h-6 w-6 shrink-0 border border-white/30"
                          style={{ backgroundColor: product.color_hex }}
                        />
                      )}
                    </div>
                    {/* Spec chips on hover. Opaque, not backdrop-blur -- a backdrop filter
                        inside a skewed, scrolling container is re-rastered every frame. */}
                    <div className="absolute left-4 top-4 flex gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      {gsm && (
                        <span className="bg-[#140A04]/85 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-[#E8A070]">
                          {gsm} gsm
                        </span>
                      )}
                      {width && (
                        <span className="bg-[#140A04]/85 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-[#E8A070]">
                          {width}" wide
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="mt-3 block font-mono text-[10px] uppercase tracking-[0.22em] text-text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </Link>
              )
            })}

            {/* Terminal CTA tile */}
            <Link
              to="/marketplace"
              data-rack-tile
              className="clip-corner group flex w-[58vw] shrink-0 items-center justify-center bg-ink sm:w-[36vw] lg:w-[24vw]"
            >
              <div className="text-center">
                <p
                  className="font-display font-bold tracking-tight text-[#F5EDE4] transition-colors group-hover:text-accent"
                  style={{ fontSize: 'clamp(22px, 2.6vw, 34px)' }}
                >
                  View all →
                </p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#F5EDE4]/45">
                  Full catalogue
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default MaterialStrip
