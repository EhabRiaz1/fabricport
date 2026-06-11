import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  ShoppingCart,
  Users,
  Settings,
  Menu,
  X,
  FileText,
  BarChart3,
  ClipboardList,
  LogOut,
  Store,
  Activity,
  LifeBuoy,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PortalNavItem, PortalZone } from '@/types/app'
import { isPortalZone } from '@/types/app'
import { useAuth } from '@/contexts/AuthContext'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { CommandPalette, isMac } from '@/components/shared/CommandPalette'
import { BrandLogo } from '@/components/layout/BrandLogo'

const PORTAL_NAV: Record<PortalZone, PortalNavItem[]> = {
  buyer: [
    { label: 'Dashboard', href: '/buyer/dashboard', icon: 'dashboard' },
    { label: 'Marketplace', href: '/marketplace', icon: 'store' },
    { label: 'Cart', href: '/buyer/cart', icon: 'cart' },
    { label: 'Inquiries', href: '/buyer/inquiries', icon: 'messages' },
    { label: 'Support', href: '/buyer/support', icon: 'support' },
    { label: 'Settings', href: '/buyer/settings', icon: 'settings' },
  ],
  supplier: [
    { label: 'Dashboard', href: '/supplier-portal/dashboard', icon: 'dashboard' },
    { label: 'Analytics', href: '/supplier-portal/analytics', icon: 'chart' },
    { label: 'Inventory', href: '/supplier-portal/inventory', icon: 'package' },
    { label: 'Inquiries', href: '/supplier-portal/inquiries', icon: 'messages' },
    { label: 'Listing Requests', href: '/supplier-portal/listing-request', icon: 'clipboard' },
    { label: 'Support', href: '/supplier-portal/support', icon: 'support' },
    { label: 'Settings', href: '/supplier-portal/settings', icon: 'settings' },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Live Monitor', href: '/admin/live', icon: 'activity' },
    { label: 'Products', href: '/admin/products', icon: 'package' },
    { label: 'Suppliers', href: '/admin/suppliers', icon: 'store' },
    { label: 'Users', href: '/admin/users', icon: 'users' },
    { label: 'Messages', href: '/admin/messages', icon: 'messages' },
    { label: 'Listing Pipeline', href: '/admin/listing-pipeline', icon: 'clipboard' },
    { label: 'Attributes', href: '/admin/attributes', icon: 'file' },
    { label: 'Settings', href: '/admin/settings', icon: 'settings' },
  ],
}

const ICON_MAP = {
  dashboard: LayoutDashboard,
  package: Package,
  messages: MessageSquare,
  cart: ShoppingCart,
  users: Users,
  settings: Settings,
  clipboard: ClipboardList,
  chart: BarChart3,
  file: FileText,
  store: Store,
  activity: Activity,
  support: LifeBuoy,
} as const

const ZONE_LABELS: Record<PortalZone, string> = {
  buyer: 'Buyer Portal',
  supplier: 'Supplier Portal',
  admin: 'Admin',
}

export interface PortalShellProps {
  children: ReactNode
  zone?: PortalZone
  title?: string
  className?: string
}

function initialsOf(name: string | null | undefined, email: string | undefined): string {
  const source = name?.trim() || email || '?'
  const parts = source.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function PortalShell({ children, zone, title, className }: PortalShellProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const resolvedZone = zone ?? isPortalZone(location.pathname) ?? 'buyer'
  const navItems = PORTAL_NAV[resolvedZone]
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((current) => !current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div className={cn('flex min-h-screen bg-background', className)}>
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <BrandLogo imgClassName="brightness-0 opacity-85" />
          <button
            type="button"
            aria-label="Close menu"
            className="text-text-secondary lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="px-5 pb-1 pt-5 font-mono text-[9px] uppercase tracking-[0.28em] text-text-muted">
          {ZONE_LABELS[resolvedZone]}
        </p>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon as keyof typeof ICON_MAP] ?? LayoutDashboard
            const active =
              location.pathname === item.href ||
              (item.href !== '/marketplace' && location.pathname.startsWith(`${item.href}/`)) ||
              location.pathname === item.href.replace(/\/$/, '')

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'group relative flex items-center gap-3 px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'bg-elevated font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-elevated/60 hover:text-text-primary',
                )}
              >
                <span
                  className={cn(
                    'absolute inset-y-1.5 left-0 w-[3px] bg-accent transition-opacity',
                    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40',
                  )}
                />
                <Icon className={cn('h-4 w-4 shrink-0', active && 'text-accent')} />
                <span>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center bg-accent px-1.5 font-mono text-[10px] text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-ink font-mono text-[11px] font-semibold text-background">
              {initialsOf(profile?.full_name, user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {profile?.full_name || user?.email}
              </p>
              <p className="truncate font-mono text-[10px] uppercase tracking-widest text-text-muted">
                {profile?.role}
              </p>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={handleSignOut}
              className="shrink-0 p-1.5 text-text-muted transition-colors hover:text-accent"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:px-8">
          <button
            type="button"
            aria-label="Open menu"
            className="text-text-secondary lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          {title && (
            <h1 className="font-display text-lg font-semibold tracking-tight text-text-primary">
              {title}
            </h1>
          )}

          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 border border-border bg-surface px-3 py-1.5 text-text-muted transition-colors hover:border-ink/30 hover:text-text-primary sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Search</span>
              <kbd className="ml-1 border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>
            <Link
              to="/marketplace"
              className="hidden font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-accent sm:block"
            >
              View site
            </Link>
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <CommandPalette
        zone={resolvedZone}
        navItems={navItems}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSignOut={handleSignOut}
      />
    </div>
  )
}

export default PortalShell
