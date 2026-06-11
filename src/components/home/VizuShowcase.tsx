import { useEffect, useRef, useState, type FC, type HTMLAttributes } from 'react'
import { motion, useInView } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, ScanLine, Layers, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

type ModelViewerProps = HTMLAttributes<HTMLElement> & {
  src?: string
  poster?: string
  alt?: string
  'camera-controls'?: boolean
  'touch-action'?: string
  'shadow-intensity'?: string
  exposure?: string
  'auto-rotate'?: boolean
}
const ModelViewer = 'model-viewer' as unknown as FC<ModelViewerProps>

const FEATURES = [
  { icon: ScanLine, label: 'Photogrammetry Capture', desc: 'High-fidelity surface scans from physical samples' },
  { icon: Layers, label: 'WebGL Rendering', desc: 'Real-time 3D viewer with drape and texture detail' },
  { icon: Cpu, label: 'Supplier-Verified Assets', desc: 'Every scan linked to authenticated inventory' },
]

interface VizuShowcaseProps {
  modelUrl?: string
  posterUrl?: string
  className?: string
}

export function VizuShowcase({ modelUrl, posterUrl, className }: VizuShowcaseProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [modelViewerReady, setModelViewerReady] = useState(false)
  const inView = useInView(textRef, { once: true, margin: '-80px' })

  useEffect(() => {
    if (!modelUrl) return
    import('@google/model-viewer').then(() => setModelViewerReady(true))
  }, [modelUrl])

  return (
    <section
      ref={sectionRef}
      className={cn('relative overflow-hidden bg-background py-0 lg:min-h-screen lg:flex lg:items-center', className)}
    >
      {/* Left accent rail */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-accent/40 to-transparent hidden lg:block" />

      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_80%_50%,rgba(232,89,60,0.07),transparent)]" />

      <div className="relative mx-auto w-full max-w-7xl px-6 py-24 lg:px-8 lg:py-0">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-20">
          {/* Text column */}
          <div ref={textRef}>
            <motion.div
              initial={{ width: 0 }}
              animate={inView ? { width: 40 } : {}}
              transition={{ duration: 0.6 }}
              className="h-px bg-accent mb-4 origin-left"
            />
            <motion.p
              initial={{ opacity: 0, x: -12 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-mono text-[9px] uppercase tracking-[0.28em] text-accent"
            >
              Vizu Technology
            </motion.p>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 font-display font-semibold tracking-tight text-text-primary"
              style={{ fontSize: 'clamp(36px, 5vw, 60px)', lineHeight: 1.05 }}
            >
              Inspect fabrics<br />
              <span className="text-text-secondary">in 3D before you buy.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-6 max-w-md text-base leading-relaxed text-text-secondary"
            >
              Every listed fabric can include a high-resolution photogrammetry scan.
              Rotate, zoom, and examine weave structure, drape, and surface detail
              — all remotely, before placing an inquiry.
            </motion.p>

            {/* Feature list */}
            <div className="mt-10 space-y-5">
              {FEATURES.map((feat, i) => {
                const Icon = feat.icon
                return (
                  <motion.div
                    key={feat.label}
                    initial={{ opacity: 0, x: -16 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.08 }}
                    className="flex items-start gap-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-elevated clip-corner-sm">
                      <Icon className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-text-primary">
                        {feat.label}
                      </p>
                      <p className="mt-0.5 text-sm text-text-muted">{feat.desc}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.65 }}
              className="mt-10"
            >
              <Link
                to="/marketplace"
                className="group inline-flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-accent"
              >
                Browse Scanned Fabrics
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </div>

          {/* 3D viewer column */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Corner accent outline */}
            <div className="absolute -inset-3 border border-border clip-corner-lg pointer-events-none" />

            <div className="relative aspect-[4/5] clip-corner-lg border border-border bg-surface overflow-hidden">
              {modelUrl && modelViewerReady ? (
                <ModelViewer
                  src={modelUrl}
                  poster={posterUrl}
                  alt="3D fabric scan preview"
                  camera-controls
                  auto-rotate
                  touch-action="pan-y"
                  shadow-intensity="1"
                  exposure="1.1"
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8 text-center">
                  {/* Animated placeholder */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                    className="relative h-24 w-24"
                  >
                    <div className="absolute inset-0 border border-accent/30 clip-corner" />
                    <div className="absolute inset-3 border border-accent/20 clip-corner" />
                    <div className="absolute inset-6 border border-accent/40 clip-corner" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-2 w-2 bg-accent rounded-full" />
                    </div>
                  </motion.div>

                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-muted">
                      3D Vizu Scanner
                    </p>
                    <p className="mt-2 text-sm text-text-secondary max-w-[200px]">
                      Interactive fabric scans render here when available.
                    </p>
                  </div>

                  {/* Decorative scan lines */}
                  <div className="absolute inset-0 pointer-events-none">
                    {[25, 50, 75].map((pct) => (
                      <div
                        key={pct}
                        className="absolute left-0 right-0 h-px bg-border"
                        style={{ top: `${pct}%` }}
                      />
                    ))}
                    {[25, 50, 75].map((pct) => (
                      <div
                        key={pct}
                        className="absolute top-0 bottom-0 w-px bg-border"
                        style={{ left: `${pct}%` }}
                      />
                    ))}
                    <motion.div
                      className="absolute left-0 right-0 h-px bg-accent/40"
                      animate={{ top: ['0%', '100%', '0%'] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Caption badge */}
            <div className="absolute -bottom-5 right-4 border border-border bg-surface px-4 py-2 clip-corner-sm">
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-text-muted">
                Join the Journey
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default VizuShowcase
