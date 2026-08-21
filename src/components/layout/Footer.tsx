import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useSupportUI } from '@/lib/support-ui'

/**
 * The "Company" column used to point at /about, /contact and /privacy. None of those are
 * routes in App.tsx, so all three fell through the `*` catch-all and silently redirected to
 * the home page. Rather than stub three pages, the column is now a real way to reach us --
 * which also gives the support widget a second entry point for anyone who scrolls past the
 * bubble without noticing it.
 */
const FOOTER_LINKS = {
  Platform: [
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'Vendors', href: '/vendors' },
    { label: 'Join as Supplier', href: '/auth/register' },
  ],
} as const

const WHATSAPP_HREF = `https://wa.me/923268419823?text=${encodeURIComponent(
  'Hi FabricPort — I have a question.',
)}`

export interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps) {
  const setSupportOpen = useSupportUI((s) => s.setOpen)

  return (
    <footer className={cn('relative border-t border-[#3C2A1A]/10 bg-[#E2D9C8] overflow-hidden', className)}>
      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-10 lg:px-8">
        <div className="grid gap-12 md:grid-cols-4 pb-12 border-b border-[#3C2A1A]/10">
          <div className="md:col-span-2">
            <Link to="/" className="font-display text-lg font-semibold tracking-tight text-[#2C1A0E]">
              Fabric<span className="text-accent">Port</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#3C2A1A]/55">
              Pakistan's premier B2B surplus fabric marketplace.
              Source verified textiles with precision specs, 3D visualization,
              and direct supplier access.
            </p>
            {/* Accent separator */}
            <div className="mt-6 h-px w-8 bg-accent" />
          </div>

          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#3C2A1A]/40">
                {title}
              </h4>
              <ul className="mt-5 space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-[#3C2A1A]/55 transition-colors hover:text-[#7A4A28]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#3C2A1A]/40">
              Talk to us
            </h4>
            <ul className="mt-5 space-y-3">
              <li>
                <button
                  type="button"
                  onClick={() => setSupportOpen(true)}
                  className="text-left text-sm text-[#3C2A1A]/55 transition-colors hover:text-[#7A4A28]"
                >
                  Chat with the team
                </button>
              </li>
              <li>
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[#3C2A1A]/55 transition-colors hover:text-[#7A4A28]"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href="mailto:hello@fabricport.com"
                  className="text-sm text-[#3C2A1A]/55 transition-colors hover:text-[#7A4A28]"
                >
                  hello@fabricport.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#3C2A1A]/40">
            &copy; {new Date().getFullYear()} FabricPort. All rights reserved.
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#3C2A1A]/40">
            Lahore &middot; Karachi &middot; Faisalabad
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
