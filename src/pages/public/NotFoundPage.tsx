import { Link, useLocation } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { PublicNav } from '@/components/layout/PublicNav'
import { Footer } from '@/components/layout/Footer'

export interface NotFoundPageProps {
  /** Rendered inside a portal shell (no public nav/footer). */
  embedded?: boolean
  homeHref?: string
  homeLabel?: string
}

/**
 * Real 404 instead of the silent redirect to "/" that used to swallow typos,
 * /about, /contact and /faq. Vercel still answers HTTP 200 for the shell, but the
 * visitor now sees what happened and where to go.
 */
export default function NotFoundPage({
  embedded = false,
  homeHref = '/',
  homeLabel = 'Back to home',
}: NotFoundPageProps) {
  const { pathname } = useLocation()

  const body = (
    <div className="mx-auto flex max-w-2xl flex-col items-start">
      <title>Page not found · FabricPort</title>
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">Error 404</p>
      <h1
        className="mt-3 font-display font-bold tracking-tight text-text-primary"
        style={{ fontSize: 'clamp(34px, 5vw, 60px)', lineHeight: 1 }}
      >
        That page isn't on the racks.
      </h1>
      <p className="mt-5 text-base leading-relaxed text-text-secondary">
        We couldn't find{' '}
        <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-[13px] text-text-primary">
          {pathname}
        </code>
        . It may have moved, or the link may have a typo.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={homeHref}
          className="inline-flex items-center gap-2 bg-ink px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-[#E8E4DC] transition-colors hover:bg-ink-soft"
        >
          {homeLabel}
        </Link>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-2 border border-border-strong px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-text-primary transition-colors hover:border-ink"
        >
          Browse the marketplace
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )

  if (embedded) {
    return <div className="py-16">{body}</div>
  }

  return (
    <div className="bg-background">
      <PublicNav />
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-28 lg:px-8">{body}</main>
      <Footer />
    </div>
  )
}
