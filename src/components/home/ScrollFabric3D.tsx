import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ScrollFabric3DProps {
  className?: string
}

export function ScrollFabric3D({ className }: ScrollFabric3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  })

  const rotateX = useTransform(smoothProgress, [0, 0.5, 1], [30, 0, -30])
  const rotateY = useTransform(smoothProgress, [0, 0.5, 1], [-20, 0, 20])
  const scale = useTransform(smoothProgress, [0, 0.5, 1], [0.8, 1, 0.8])
  const opacity = useTransform(smoothProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0])

  return (
    <section
      ref={containerRef}
      className={cn('relative min-h-[150vh] bg-[#F6F1E9] overflow-hidden', className)}
    >
      {/* Sticky container */}
      <div className="sticky top-0 h-screen flex items-center justify-center">
        <div className="relative w-full max-w-6xl mx-auto px-6 lg:px-8 grid lg:grid-cols-2 gap-16 items-center">
          
          {/* 3D Fabric visualization */}
          <motion.div
            style={{ rotateX, rotateY, scale, opacity }}
            className="relative h-[500px] flex items-center justify-center"
          >
            <div className="relative w-[280px] h-[360px] lg:w-[320px] lg:h-[420px]" style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}>
              {/* Layered fabric sheets */}
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0"
                  style={{
                    transform: `translateZ(${i * 15}px)`,
                    transformStyle: 'preserve-3d',
                  }}
                  animate={{
                    y: [0, -8 + i * 2, 0],
                  }}
                  transition={{
                    duration: 3 + i * 0.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                >
                  <div
                    className={cn(
                      'w-full h-full rounded-sm',
                      i === 0 ? 'bg-gradient-to-br from-[#C8B49A] to-[#A89478]' :
                      i === 1 ? 'bg-gradient-to-br from-[#BCA888] to-[#9C886C]' :
                      i === 2 ? 'bg-gradient-to-br from-[#B09C7C] to-[#907C60]' :
                      i === 3 ? 'bg-gradient-to-br from-[#A49070] to-[#847054]' :
                      'bg-gradient-to-br from-[#988464] to-[#786448]'
                    )}
                    style={{
                      boxShadow: i === 0 
                        ? '0 30px 60px -15px rgba(180, 120, 70, 0.35)' 
                        : `0 ${15 + i * 8}px ${30 + i * 12}px rgba(80, 50, 20, ${0.15 + i * 0.06})`,
                    }}
                  >
                    {/* Subtle weave texture */}
                    <div className="absolute inset-0 rounded-sm overflow-hidden opacity-25">
                      <svg className="w-full h-full">
                        <defs>
                          <pattern id={`weave-${i}`} width="6" height="6" patternUnits="userSpaceOnUse">
                            <path 
                              d="M0 3h6M3 0v6" 
                              stroke={i === 0 ? 'rgba(100,60,20,0.5)' : 'rgba(60,40,10,0.3)'} 
                              strokeWidth="0.3" 
                              fill="none" 
                            />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill={`url(#weave-${i})`} />
                      </svg>
                    </div>

                    {/* Top edge highlight */}
                    {i === 0 && (
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#E8B888]/60 to-transparent" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Text content */}
          <motion.div style={{ opacity }} className="text-center lg:text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#7A4A28] mb-4">
              3D Visualization
            </p>
            <h2
              className="font-display font-bold text-[#2C1A0E] tracking-tight mb-6"
              style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1 }}
            >
              See Every Thread
            </h2>
            <p className="text-[#3C2A1A]/55 text-base leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
              Our Vizu technology captures high-fidelity 3D scans of every fabric. 
              Examine weave patterns, texture, and drape before you buy.
            </p>

            {/* Specs */}
            <div className="flex items-center justify-center lg:justify-start gap-8">
              {[
                { value: '360°', label: 'View' },
                { value: '4K', label: 'Detail' },
                { value: 'Real', label: 'Scale' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-display text-2xl font-bold text-[#2C1A0E]">{stat.value}</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-[#3C2A1A]/40">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default ScrollFabric3D
