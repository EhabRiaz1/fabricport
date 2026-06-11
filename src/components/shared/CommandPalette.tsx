import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  CornerDownLeft,
  ExternalLink,
  LogOut,
  Package,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { PortalNavItem, PortalZone } from '@/types/app'

interface PaletteItem {
  id: string
  group: 'Navigate' | 'Actions' | 'Products'
  label: string
  hint?: string
  run: () => void
}

interface ProductHit {
  id: string
  title: string
  status: string
}

export const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export interface CommandPaletteProps {
  zone: PortalZone
  navItems: PortalNavItem[]
  open: boolean
  onClose: () => void
  onSignOut: () => void
}

/**
 * Cmd/Ctrl+K palette: jump anywhere in the portal, run actions, and (for
 * admins) jump straight into a product's edit screen by name.
 */
export function CommandPalette({ zone, navItems, open, onClose, onSignOut }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [productHits, setProductHits] = useState<ProductHit[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Reset state each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery('')
      setProductHits([])
      setActiveIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Admin-only: fuzzy product jump.
  useEffect(() => {
    if (!open || zone !== 'admin') return
    clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setProductHits([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('products')
        .select('id, title, status')
        .ilike('title', `%${trimmed}%`)
        .limit(5)
      setProductHits((data ?? []) as ProductHit[])
    }, 180)
    return () => clearTimeout(debounceRef.current)
  }, [query, open, zone])

  const go = useCallback(
    (path: string) => {
      onClose()
      navigate(path)
    },
    [navigate, onClose],
  )

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase()
    const nav: PaletteItem[] = navItems
      .filter((item) => !q || item.label.toLowerCase().includes(q))
      .map((item) => ({
        id: `nav-${item.href}`,
        group: 'Navigate',
        label: item.label,
        run: () => go(item.href),
      }))

    const actions: PaletteItem[] = [
      {
        id: 'action-view-site',
        group: 'Actions' as const,
        label: 'View public site',
        run: () => go('/marketplace'),
      },
      {
        id: 'action-sign-out',
        group: 'Actions' as const,
        label: 'Sign out',
        run: () => {
          onClose()
          onSignOut()
        },
      },
    ].filter((item) => !q || item.label.toLowerCase().includes(q))

    const products: PaletteItem[] = productHits.map((hit) => ({
      id: `product-${hit.id}`,
      group: 'Products',
      label: hit.title,
      hint: hit.status,
      run: () => go(`/admin/products/${hit.id}/edit`),
    }))

    return [...nav, ...products, ...actions]
  }, [navItems, query, productHits, go, onClose, onSignOut])

  useEffect(() => {
    setActiveIndex(0)
  }, [items.length, query])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, items.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        items[activeIndex]?.run()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, items, activeIndex, onClose])

  let lastGroup: string | null = null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="palette-backdrop"
            className="fixed inset-0 z-[70] bg-ink/35 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
          />
          <div className="fixed inset-x-0 top-[16vh] z-[70] flex justify-center px-4">
            <motion.div
              key="palette-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              className="w-full max-w-xl overflow-hidden border border-ink/15 bg-surface shadow-[0_32px_80px_-16px_rgba(26,14,6,0.4)] clip-corner-sm"
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-3 border-b border-border px-4">
                <Search className="h-4 w-4 shrink-0 text-text-muted" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    zone === 'admin' ? 'Jump to a page or search products…' : 'Jump to a page…'
                  }
                  className="h-13 w-full bg-transparent py-4 text-sm text-text-primary outline-none placeholder:text-text-muted"
                />
                <kbd className="shrink-0 border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-text-muted">
                  Esc
                </kbd>
              </div>

              <div className="max-h-[46vh] overflow-y-auto py-2">
                {items.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-text-muted">
                    Nothing matches “{query}”
                  </p>
                )}
                {items.map((item, index) => {
                  const showHeader = item.group !== lastGroup
                  lastGroup = item.group
                  const active = index === activeIndex
                  return (
                    <div key={item.id}>
                      {showHeader && (
                        <p className="px-4 pb-1 pt-3 font-mono text-[9px] uppercase tracking-[0.24em] text-text-muted">
                          {item.group}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={item.run}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                          active ? 'bg-elevated text-text-primary' : 'text-text-secondary',
                        )}
                      >
                        {item.group === 'Products' ? (
                          <Package className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                        ) : item.id === 'action-sign-out' ? (
                          <LogOut className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                        ) : item.id === 'action-view-site' ? (
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                        ) : (
                          <ArrowRight
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 transition-colors',
                              active ? 'text-accent' : 'text-text-muted',
                            )}
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.hint && (
                          <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-text-muted">
                            {item.hint}
                          </span>
                        )}
                        {active && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                        )}
                      </button>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export default CommandPalette
