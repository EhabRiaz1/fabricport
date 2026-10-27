import type { ReactNode } from 'react'
import { PublicNav } from '@/components/layout/PublicNav'
import { Footer } from '@/components/layout/Footer'

export interface LegalLayoutProps {
  eyebrow: string
  title: string
  /** e.g. "Effective 27 October 2026" */
  meta?: string
  children: ReactNode
}

/**
 * Shared frame for /privacy and /terms: public nav, a narrow editorial column,
 * footer. The typographic rules live here so both documents read the same.
 */
export function LegalLayout({ eyebrow, title, meta, children }: LegalLayoutProps) {
  return (
    <div className="bg-background">
      <PublicNav />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-28 lg:px-8">
        <header className="border-b border-border pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">{eyebrow}</p>
          <h1
            className="mt-3 font-display font-bold tracking-tight text-text-primary"
            style={{ fontSize: 'clamp(32px, 4.5vw, 52px)', lineHeight: 1.02 }}
          >
            {title}
          </h1>
          {meta && (
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
              {meta}
            </p>
          )}
        </header>
        <article
          className={[
            'legal-copy mt-10 text-[15px] leading-relaxed text-text-secondary',
            '[&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-text-primary',
            '[&_h3]:mt-6 [&_h3]:font-mono [&_h3]:text-[11px] [&_h3]:uppercase [&_h3]:tracking-[0.18em] [&_h3]:text-bronze',
            '[&_p]:mt-4 [&_ul]:mt-3 [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:list-disc [&_li]:marker:text-bronze',
            '[&_a]:text-bronze [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-accent',
          ].join(' ')}
        >
          {children}
        </article>
      </main>
      <Footer />
    </div>
  )
}

export default LegalLayout
