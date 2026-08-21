import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BannerImage } from '@/components/shared/BannerImage'
import { BrandLogo } from '@/components/layout/BrandLogo'

export interface AuthLayoutProps {
  children: ReactNode
  eyebrow: string
  heading: string
  subheading?: string
}

export function AuthLayout({ children, eyebrow, heading, subheading }: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Editorial imagery panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <BannerImage className="absolute inset-0" sizes="(min-width: 1024px) 55vw, 100vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A0E06]/85 via-[#1A0E06]/30 to-[#1A0E06]/20" />
        <div className="grain absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <BrandLogo imgClassName="h-8 brightness-0 invert" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#E8A070]">
              Pakistan's B2B fabric marketplace
            </p>
            <p
              className="mt-4 max-w-md font-display font-bold tracking-tight text-[#F5EDE4]"
              style={{ fontSize: 'clamp(28px, 3vw, 44px)', lineHeight: 1.05 }}
            >
              Every thread verified. Every meter accounted for.
            </p>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-[#F5EDE4]/60">
              Source surplus fabric from verified Pakistani mills — precision specs,
              3D scans, and direct supplier conversations.
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden">
            <BrandLogo />
          </span>
          <Link
            to="/"
            className="font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent"
          >
            ← Back to site
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-primary">
            {heading}
          </h1>
          {subheading && (
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{subheading}</p>
          )}
          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
    </div>
  )
}

export default AuthLayout
