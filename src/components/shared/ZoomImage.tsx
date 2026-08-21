import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ZoomIn } from 'lucide-react'
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
  /** Magnification factor under the lens. */
  zoom?: number
  /** Opens the fullscreen viewer (tap on touch, click on desktop). */
  onOpenViewer?: () => void
  sizes?: string
}

/**
 * Product image with a hover magnifier.
 *
 * Fabric buyers are looking for weave, slub and hand, which only read at native resolution,
 * so this magnifies rather than merely enlarging.
 *
 * Technique: `transform: scale()` with a moving `transform-origin`, inside an
 * `overflow-hidden` frame. The alternatives lose:
 *   - a background-position lens needs the image loaded a second time as a CSS background,
 *     so it cannot reuse the already-decoded bitmap, cannot participate in srcSet, and
 *     re-rasterises the background on every pointer move;
 *   - a side-panel zoom needs ~400px beside the image, which on this page is the spec card.
 * Scale + transform-origin is compositor-only: no repaint, no second request.
 *
 * The lens is fed by the `large` (1600w) variant, not `original`. Before the image repair an
 * original could be a 240px thumbnail; after it, it can be a 3000px 4 MB JPEG that would
 * stall the first hover. 1600w at 2.2x over a ~720 CSS px frame is close to exact.
 */
export function ZoomImage({
  variants,
  alt,
  className,
  zoom = 2.2,
  onOpenViewer,
  sizes = '(min-width: 1024px) 50vw, 100vw',
}: ZoomImageProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const rafRef = useRef(0)
  const pendingRef = useRef<{ x: number; y: number } | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const [canHover, setCanHover] = useState(false)
  /**
   * Falls back to the untouched original if the `large` derivative is missing.
   *
   * `large` was introduced with this work and is generated per image; anything added before
   * the sweep finishes -- or any original sharp could not process -- simply has no 1600px
   * file, and hovering would 404 into a broken frame.
   */
  const [largeFailed, setLargeFailed] = useState(false)
  const zoomSrc = largeFailed ? variants.original : variants.large
  const reduced = useReducedMotion()

  useEffect(() => {
    // Pointer capability, not screen width: a small laptop hovers, a large tablet does not.
    const query = window.matchMedia('(hover: hover) and (pointer: fine)')
    const sync = () => setCanHover(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const applyOrigin = useCallback(() => {
    rafRef.current = 0
    const img = imgRef.current
    const point = pendingRef.current
    if (!img || !point) return
    img.style.transformOrigin = `${point.x * 100}% ${point.y * 100}%`
  }, [])

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canHover || !zoomed) return
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    pendingRef.current = {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
    }
    // Coalesce to one style write per frame regardless of pointer event rate.
    if (!rafRef.current) rafRef.current = requestAnimationFrame(applyOrigin)
  }

  const onPointerEnter = () => {
    if (!canHover) return
    // Warm the full-size file on first hover only; the browser caches it thereafter.
    const preload = new Image()
    preload.onerror = () => setLargeFailed(true)
    preload.src = zoomSrc
    setZoomed(true)
  }

  const onPointerLeave = () => {
    if (!zoomed) return
    setZoomed(false)
    const img = imgRef.current
    if (img) img.style.transformOrigin = '50% 50%'
  }

  return (
    <div
      ref={frameRef}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
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
        ref={imgRef}
        // object-contain on a tinted mat, not object-cover. Sources run from 1:1 to about
        // 1.22:1, so cover in a square frame shears up to 18% off the sides of a landscape
        // photograph. The frame stays square for every product so the two-column layout
        // never jumps.
        src={zoomed ? zoomSrc : variants.medium}
        srcSet={
          zoomed
            ? undefined
            : largeFailed
              ? `${variants.card} 480w, ${variants.medium} 960w`
              : `${variants.card} 480w, ${variants.medium} 960w, ${variants.large} 1600w`
        }
        onError={() => {
          if (!largeFailed) setLargeFailed(true)
        }}
        sizes={zoomed ? undefined : sizes}
        alt={alt}
        loading="eager"
        decoding="async"
        draggable={false}
        className="h-full w-full object-contain"
        style={{
          transform: zoomed ? `scale(${zoom})` : 'scale(1)',
          transition: reduced ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-[#2C1A0E]/10"
      />

      {canHover && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 bg-[#140A04]/85 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[#F5EDE4] transition-opacity duration-200',
            zoomed ? 'opacity-100' : 'opacity-0 group-hover:opacity-70',
          )}
        >
          <ZoomIn className="h-3 w-3" />
          {zoomed ? `${zoom}×` : 'Hover to zoom'}
        </span>
      )}
    </div>
  )
}

export default ZoomImage
