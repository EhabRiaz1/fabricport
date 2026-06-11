import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const FOOTER_LINKS = {
  Platform: [
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'Vendors', href: '/vendors' },
    { label: 'Join as Supplier', href: '/auth/register' },
  ],
  Company: [
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
    { label: 'Privacy', href: '/privacy' },
  ],
} as const

export interface FooterProps {
  className?: string
}

export function Footer({ className }: FooterProps) {
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
