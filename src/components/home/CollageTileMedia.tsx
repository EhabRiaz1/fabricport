import { cn } from '@/lib/utils'

interface CollageTileMediaProps {
  src: string
  alt: string
  className?: string
  /** Darken image for white text (0–1) */
  overlay?: number
}

/** Full-bleed tile background image with cinematic gradient for legible labels */
export function CollageTileMedia({
  src,
  alt,
  className,
  overlay = 0.55,
}: CollageTileMediaProps) {
  return (
    <div className={cn('absolute inset-0', className)} aria-hidden>
      <img
        src={src}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        loading="lazy"
        decoding="async"
      />
      <div
        className="absolute inset-0 bg-black transition-opacity duration-500 group-hover:opacity-90"
        style={{ opacity: overlay }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/20" />
      <span className="sr-only">{alt}</span>
    </div>
  )
}
