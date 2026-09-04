import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface ZoomImageVariants {
  card: string
  medium: string
  large: string
  original: string
}

export interface ZoomImageProps {
  variants: ZoomImageVariants
  alt: string
  className?: string
  /** Magnification factor inside the panel. */
  zoom?: number
  /** Opens the fullscreen viewer (tap on touch, click on desktop). */
  onOpenViewer?: () => void
  sizes?: string
}

/** Gap between the photo and the zoom panel, and the margin it keeps from the viewport. */
const PANEL_GAP = 16
const VIEWPORT_MARGIN = 16
/** Below this the panel has nowhere to live; tap-to-open-viewer carries the page instead. */
const MIN_PANEL_WIDTH = 320

interface PanelBox {
  top: number
  left: number
  width: number
  height: number
  /** The photo frame's size at the moment the panel opened, so nothing re-reads layout. */
  frameWidth: number
  frameHeight: number
}

/**
 * Product image with a classic side-panel zoom.
 *
 * Fabric buyers are looking for weave, slub and hand, which only read at native resolution,
 * so this magnifies rather than merely enlarging. It used to magnify *inside* the photo
 * frame -- `transform: scale()` on a moving `transform-origin` -- which meant the thing you
 * were inspecting covered the thing you were pointing at, and a magnifier chip sat on top
 * of the picture. The e-commerce convention is better: the photo stays whole with a lens
 * rectangle showing what is under the cursor, and the magnified crop appears beside it.
 *
 * The panel is portalled to `document.body` and positioned `fixed` from the frame's
 * `getBoundingClientRect()`. It cannot be an absolutely-positioned sibling: the detail
 * page wraps this frame in `clip-corner`, a `clip-path`, and `clip-path` clips descendants
 * regardless of `overflow` or z-index. Fixed positioning also means no ancestor's stacking
 * context or scroll container can trap it.
 *
 * Movement inside the panel is one `translate3d` on an `<img>` that shares its `src` with
 * the preloaded hero, so it is compositor-only and costs no second network request. A
 * `background-position` lens would re-rasterise on every pointer move and could not
 * participate in `srcSet`.
 *
 * The panel is fed by the `large` (1600w) variant, not `original`. Before the image repair
 * an original could be a 240px thumbnail; after it, it can be a 3000px 4 MB JPEG that would
 * stall the first hover.
 */
export function ZoomImage({
  variants,
  alt,
  className,
  zoom = 2.4,
  onOpenViewer,
  sizes = '(min-width: 1024px) 50vw, 100vw',
}: ZoomImageProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const pendingRef = useRef<{ x: number; y: number } | null>(null)
  const panelImgRef = useRef<HTMLImageElement>(null)
  const lensRef = useRef<HTMLSpanElement>(null)

  const [zoomed, setZoomed] = useState(false)
  const [canHover, setCanHover] = useState(false)
  const [panel, setPanel] = useState<PanelBox | null>(null)
  /** Same value as `panel`, readable from the rAF callback without a stale closure. */
  const panelRef = useRef<PanelBox | null>(null)
  /**
   * Falls back to the untouched original if the `large` derivative is missing.
   *
   * `large` is generated per image; anything added before a sweep finishes -- or any
   * original sharp could not process -- simply has no 1600px file, and hovering would 404
   * into a broken frame.
   */
  const [largeFailed, setLargeFailed] = useState(false)
  const zoomSrc = largeFailed ? variants.original : variants.large

  useEffect(() => {
    // Pointer capability, not screen width: a small laptop hovers, a large tablet does not.
    const query = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setCanHover(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  /**
   * Where the panel goes: to the right of the photo if it fits, otherwise to the left,
   * otherwise nowhere (the caller falls back to tap-to-open-viewer).
   */
  const measurePanel = useCallback((): PanelBox | null => {
    const frame = frameRef.current
    if (!frame) return null
    const rect = frame.getBoundingClientRect()

    const rightRoom = window.innerWidth - rect.right - PANEL_GAP - VIEWPORT_MARGIN
    const leftRoom = rect.left - PANEL_GAP - VIEWPORT_MARGIN
    const useRight = rightRoom >= MIN_PANEL_WIDTH || rightRoom >= leftRoom
    const room = useRight ? rightRoom : leftRoom
    if (room < MIN_PANEL_WIDTH) return null

    const width = Math.min(room, Math.max(rect.width, MIN_PANEL_WIDTH))
    const height = Math.min(rect.height, window.innerHeight - 2 * VIEWPORT_MARGIN)
    const top = Math.min(
      Math.max(rect.top, VIEWPORT_MARGIN),
      window.innerHeight - height - VIEWPORT_MARGIN,
    )
    const left = useRight ? rect.right + PANEL_GAP : rect.left - PANEL_GAP - width

    return { top, left, width, height, frameWidth: rect.width, frameHeight: rect.height }
  }, [])

  /**
   * Writes the pointer position straight to the DOM.
   *
   * Deliberately not React state: at 120 Hz this would be ~120 renders a second of the
   * whole detail page. The panel's geometry lives in state, the per-frame movement does not.
   */
  const applyPosition = useCallback(() => {
    rafRef.current = 0
    const point = pendingRef.current
    const box = panelRef.current
    const img = panelImgRef.current
    const lens = lensRef.current
    if (!point || !box || !img) return

    // The panel img is laid out at the frame's size scaled by `zoom`, so a point at
    // fraction (x, y) of the frame is at (x, y) of the scaled image too.
    const scaledWidth = box.frameWidth * zoom
    const scaledHeight = box.frameHeight * zoom
    const offsetX = clamp(
      point.x * scaledWidth - box.width / 2,
      0,
      Math.max(0, scaledWidth - box.width),
    )
    const offsetY = clamp(
      point.y * scaledHeight - box.height / 2,
      0,
      Math.max(0, scaledHeight - box.height),
    )
    img.style.transform = `translate3d(${-offsetX}px, ${-offsetY}px, 0)`

    if (lens) {
      // The lens is the region the panel is showing, drawn back onto the source photo.
      const lensWidth = Math.min(box.frameWidth, (box.width / scaledWidth) * box.frameWidth)
      const lensHeight = Math.min(
        box.frameHeight,
        (box.height / scaledHeight) * box.frameHeight,
      )
      const lensX = clamp(
        point.x * box.frameWidth - lensWidth / 2,
        0,
        box.frameWidth - lensWidth,
      )
      const lensY = clamp(
        point.y * box.frameHeight - lensHeight / 2,
        0,
        box.frameHeight - lensHeight,
      )
      lens.style.width = `${lensWidth}px`
      lens.style.height = `${lensHeight}px`
      lens.style.transform = `translate3d(${lensX}px, ${lensY}px, 0)`
    }
  }, [zoom])

  /** Pointer position as a 0..1 fraction of the frame, from the rect captured on enter. */
  const trackPointer = (clientX: number, clientY: number) => {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    pendingRef.current = {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    }
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canHover || !zoomed) return
    trackPointer(event.clientX, event.clientY)
    // Coalesce to one style write per frame regardless of pointer event rate.
    if (!rafRef.current) rafRef.current = requestAnimationFrame(applyPosition)
  }

  const onPointerEnter = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canHover) return
    const box = measurePanel()
    if (!box) return

    // Warm the full-size file on first hover only; the browser caches it thereafter.
    const preload = new Image()
    preload.onerror = () => setLargeFailed(true)
    preload.src = zoomSrc

    trackPointer(event.clientX, event.clientY)
    panelRef.current = box
    setPanel(box)
    setZoomed(true)
  }

  const closePanel = useCallback(() => {
    setZoomed(false)
    setPanel(null)
    panelRef.current = null
    pendingRef.current = null
  }, [])

  // Scrolling or resizing while hovering would leave the panel pinned to stale coordinates,
  // and re-measuring mid-gesture fights the pointer. Closing is the honest response.
  useEffect(() => {
    if (!zoomed) return
    window.addEventListener('scroll', closePanel, { passive: true, capture: true })
    window.addEventListener('resize', closePanel)
    return () => {
      window.removeEventListener('scroll', closePanel, { capture: true })
      window.removeEventListener('resize', closePanel)
    }
  }, [zoomed, closePanel])

  // Paint the first frame before the panel is visible, so it opens already tracking the
  // cursor rather than snapping from the top-left corner.
  useLayoutEffect(() => {
    if (zoomed) applyPosition()
  }, [zoomed, applyPosition])

  return (
    <>
      <div
        ref={frameRef}
        onPointerEnter={onPointerEnter}
        onPointerLeave={closePanel}
        onPointerMove={onPointerMove}
        onClick={onOpenViewer}
        onKeyDown={(event) => {
          if (!onOpenViewer) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpenViewer()
          }
        }}
        role={onOpenViewer ? 'button' : undefined}
        tabIndex={onOpenViewer ? 0 : undefined}
        aria-label={onOpenViewer ? `${alt} — open full size` : undefined}
        className={cn(
          'group relative aspect-square w-full overflow-hidden bg-elevated',
          onOpenViewer && 'cursor-zoom-in focus:outline-none focus-visible:ring-1 focus-visible:ring-accent',
          className,
        )}
      >
        <img
          // object-contain on a tinted mat, not object-cover. Sources run from 1:1 to about
          // 1.22:1, so cover in a square frame shears up to 18% off the sides of a landscape
          // photograph. The frame stays square for every product so the two-column layout
          // never jumps.
          src={variants.medium}
          srcSet={
            largeFailed
              ? `${variants.card} 480w, ${variants.medium} 960w`
              : `${variants.card} 480w, ${variants.medium} 960w, ${variants.large} 1600w`
          }
          onError={() => {
            if (!largeFailed) setLargeFailed(true)
          }}
          sizes={sizes}
          alt={alt}
          loading="eager"
          decoding="async"
          draggable={false}
          className="h-full w-full object-contain"
        />

        {/* The lens: the crop the panel is currently showing, drawn back on the photo. */}
        {zoomed && (
          <span
            ref={lensRef}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 border border-[#F5EDE4]/70 bg-[#F5EDE4]/12 shadow-[0_0_0_9999px_rgba(20,10,4,0.28)]"
          />
        )}

        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-[#2C1A0E]/10"
        />
      </div>

      {zoomed &&
        panel &&
        createPortal(
          <div
            aria-hidden
            style={{
              position: 'fixed',
              top: panel.top,
              left: panel.left,
              width: panel.width,
              height: panel.height,
            }}
            className="pointer-events-none z-[60] overflow-hidden border border-[#2C1A0E]/15 bg-elevated shadow-2xl"
          >
            <img
              ref={panelImgRef}
              src={zoomSrc}
              alt=""
              draggable={false}
              onError={() => {
                if (!largeFailed) setLargeFailed(true)
              }}
              style={{
                width: panel.frameWidth * zoom,
                height: panel.frameHeight * zoom,
                maxWidth: 'none',
                willChange: 'transform',
              }}
              className="object-contain"
            />
            <span className="pointer-events-none absolute bottom-2 right-2 bg-[#140A04]/85 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[#F5EDE4]">
              {zoom}×
            </span>
          </div>,
          document.body,
        )}
    </>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default ZoomImage
