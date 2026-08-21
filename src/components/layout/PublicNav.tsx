import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_HOME_PATHS } from '@/types/app'
import { BrandLogo } from '@/components/layout/BrandLogo'

const NAV_LINKS = [
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Vendors', href: '/vendors' },
] as const

export interface PublicNavProps {
  className?: string
}

export function PublicNav({ className }: PublicNavProps) {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const { isAuthenticated, role } = useAuth()
  const isHeroPage = location.pathname === '/'
  const portalHref = role ? ROLE_HOME_PATHS[role] : '/auth/login'

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 60)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const solid = scrolled || !isHeroPage

  return (
    <header
      className={cn(
        // transition-colors, NOT transition-all: `all` animates backdrop-filter too, so
        // every flip of `solid` re-rendered a full-width blur for 400ms straight. The blur
        // radius also drops to md -- cost scales superlinearly with radius, and the
        // background is already 96% opaque so the blur is barely visible either way.
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300 [contain:paint]',
        solid
          ? 'border-b border-[#3C2A1A]/10 bg-[#F6F1E9]/96 backdrop-blur-md'
          : 'bg-transparent',
        className,
      )}
    >
      {/* Top micro-rule — always present on hero page */}
      {!solid && (
        <div className="h-px w-full bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
      )}

      <nav className="mx-auto flex h-[60px] max-w-7xl items-center justify-between px-6 lg:px-8">
        <BrandLogo imgClassName={solid ? 'brightness-0 opacity-85' : undefined} />

        {/* Center links */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                'font-mono text-[10px] uppercase tracking-[0.18em] transition-colors hover:text-accent',
                solid ? 'text-[#3C2A1A]/55' : 'text-white/60',
                location.pathname === link.href && 'text-accent',
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4">
          <Link
            to={portalHref}
            className={cn(
              'hidden font-mono text-[10px] uppercase tracking-[0.18em] transition-colors hover:text-accent md:block',
              solid ? 'text-[#3C2A1A]/55' : 'text-white/60',
            )}
          >
            {isAuthenticated ? 'My Portal' : 'Login'}
          </Link>
          <Link
            to="/marketplace"
            className={cn(
              'inline-flex items-center font-mono text-[10px] uppercase tracking-widest px-4 py-2 transition-all duration-200 clip-corner-sm',
              solid
                ? 'bg-[#2C1A0E] text-[#F5EDE4] hover:bg-[#3C2A1A]'
                : 'border border-white/25 text-white/80 hover:border-accent hover:text-accent',
            )}
          >
            Browse
          </Link>
        </div>
      </nav>
    </header>
  )
}

export default PublicNav
