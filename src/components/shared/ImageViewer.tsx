import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import type { ZoomImageVariants } from '@/components/shared/ZoomImage'

export interface ImageViewerProps {
  images: ZoomImageVariants[]
  index: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onIndexChange: (index: number) => void
  alt: string
}

/**
 * Fullscreen image viewer -- the touch counterpart to `ZoomImage`'s hover lens, and the
 * click-through on desktop.
 *
 * Zooming is delegated to the browser: `touch-action: pinch-zoom` on a scrollable frame
 * holding an unconstrained image gives native pinch and pan, which beats any JS gesture
 * handler for feel and costs nothing.
 */
export function ImageViewer({
  images,
  index,
  open,
  onOpenChange,
  onIndexChange,
  alt,
}: ImageViewerProps) {
  const [loaded, setLoaded] = useState(false)
  // As in ZoomImage: not every image has a `large` derivative yet.
  const [largeFailed, setLargeFailed] = useState(false)
  const current = images[index]

  useEffect(() => {
    setLoaded(false)
    setLargeFailed(false)
  }, [index])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') onIndexChange((index + 1) % images.length)
      if (event.key === 'ArrowLeft') onIndexChange((index - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, index, images.length, onIndexChange])

  if (!current) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showClose={false}
        className="h-[100dvh] max-w-none border-0 bg-[#140A04] p-0"
        aria-label={`${alt} — full size`}
      >
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#F5EDE4]/55">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="grid h-9 w-9 place-items-center text-[#F5EDE4]/70 transition-colors hover:text-[#F5EDE4]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            data-lenis-prevent
            className="flex-1 overflow-auto overscroll-contain"
            style={{ touchAction: 'pinch-zoom' }}
          >
            <div className="flex min-h-full items-center justify-center p-4">
              <img
                key={current.large}
                src={largeFailed ? current.original : current.large}
                alt={alt}
                onLoad={() => setLoaded(true)}
                onError={() => setLargeFailed(true)}
                className="max-h-full w-auto max-w-none object-contain transition-opacity duration-200"
                style={{ opacity: loaded ? 1 : 0 }}
              />
            </div>
          </div>

          {images.length > 1 && (
            <div className="flex items-center justify-center gap-4 px-5 py-4">
              <button
                type="button"
                onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
                aria-label="Previous image"
                className="clip-corner-sm grid h-11 w-11 place-items-center border border-[#F5EDE4]/25 text-[#F5EDE4]/80 transition-colors hover:border-[#F5EDE4]/60"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onIndexChange((index + 1) % images.length)}
                aria-label="Next image"
                className="clip-corner-sm grid h-11 w-11 place-items-center border border-[#F5EDE4]/25 text-[#F5EDE4]/80 transition-colors hover:border-[#F5EDE4]/60"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default ImageViewer
