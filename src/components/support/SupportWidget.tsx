import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { MessageCircle, X } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { SupportThread } from '@/components/chat/SupportThread'
import { CountBadge } from '@/components/shared/CountBadge'
import { useAuth } from '@/contexts/AuthContext'
import { useSupportUnread } from '@/hooks/useSupportUnread'
import { useCartUI } from '@/lib/cart'
import { useSupportUI } from '@/lib/support-ui'

/**
 * Floating support chat, bottom right.
 *
 * Targets `SupportThread` rather than `ChatThread`: a support thread is just
 * `support_messages WHERE user_id = X`, so the first insert creates it. `ChatThread` needs
 * an inquiry or sample request to already exist and cannot open a conversation.
 *
 * Signed-out visitors get an intro panel with sign-in CTAs. `support_messages` RLS is
 * `TO authenticated` and deliberately stays that way -- no anonymous write surface. The
 * thread is not mounted at all when signed out, so public pages never fire a doomed query
 * plus a realtime subscription.
 */

/** Portals already have a dedicated /support page; auth screens want no distractions. */
const HIDDEN_ROUTES = /^\/(buyer|supplier-portal|admin|auth)/

export function SupportWidget() {
  const { pathname } = useLocation()
  const { isAuthenticated, user } = useAuth()
  const open = useSupportUI((s) => s.open)
  const setOpen = useSupportUI((s) => s.setOpen)
  const [isDesktop, setIsDesktop] = useState(false)
  const reduced = useReducedMotion()
  const cartOpen = useCartUI((s) => s.open)
  const { unread, clear } = useSupportUnread(open || !isAuthenticated ? null : user?.id ?? null)

  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)')
    const sync = () => setIsDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (open) clear()
    // `clear` is a fresh closure each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close on route change so the panel doesn't follow you across the site.
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (HIDDEN_ROUTES.test(pathname)) return null

  const panel = <SupportPanel onClose={() => setOpen(false)} userId={user?.id ?? null} />

  return (
    <>
      {/* z-40: below the nav and below any sheet, so an open drawer covers it rather than
          fighting it. Hidden outright while the cart drawer is open. */}
      {!cartOpen &&
        createPortal(
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Close support chat' : 'Chat with the FabricPort team'}
            aria-expanded={open}
            className="clip-corner-sm fixed right-5 z-40 grid h-12 w-12 place-items-center bg-[#2C1A0E] text-[#F5EDE4] shadow-[0_10px_30px_-8px_rgba(26,14,6,0.55)] transition-colors hover:bg-[#3C2A1A]"
            style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
            {!open && (
              <CountBadge count={unread} className="absolute -right-1.5 -top-1.5" />
            )}
          </button>,
          document.body,
        )}

      {isDesktop ? (
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                role="dialog"
                aria-label="Support chat"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: reduced ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                // No overlay: this is a widget, not a modal. The page stays usable, which
                // is also why there is no focus trap.
                className="clip-corner fixed right-5 z-[55] flex w-[380px] flex-col overflow-hidden border border-[#C8C4BC] bg-[#F6F1E9] shadow-[0_24px_70px_-18px_rgba(26,14,6,0.45)]"
                style={{
                  bottom: 'calc(max(1.25rem, env(safe-area-inset-bottom)) + 3.75rem)',
                  // The signed-out intro is a short pitch, so let it size to its content
                  // instead of floating in 300px of empty cream.
                  height: user ? 'min(560px, calc(100dvh - 140px))' : 'auto',
                  maxHeight: 'calc(100dvh - 140px)',
                }}
              >
                {panel}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )
      ) : (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showClose={false}
            aria-label="Support chat"
            aria-describedby={undefined}
            className="h-[92dvh] max-w-none bg-[#F6F1E9] p-0"
          >
            {panel}
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}

function SupportPanel({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const { pathname } = useLocation()

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-[#C8C4BC] px-4 py-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold tracking-tight text-[#2C1A0E]">
            FabricPort support
          </p>
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-[#9C8870]">
            Sourcing team · replies in a few hours
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-8 w-8 shrink-0 place-items-center text-[#3C2A1A]/50 transition-colors hover:text-[#2C1A0E]"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {userId ? (
        <SupportThread
          threadUserId={userId}
          currentUserId={userId}
          compact
          // tailwind-merge lets min-h-0 win over the component's built-in min-h-[420px].
          className="h-full min-h-0 flex-1 bg-transparent"
        />
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-5 px-6 py-8 text-center">
          <p className="text-sm leading-relaxed text-[#3C2A1A]/75">
            Questions about a fabric, MOQ or shipping? Our sourcing team replies within a
            few hours.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              to="/auth/login"
              state={{ from: pathname }}
              className="w-full bg-[#2C1A0E] py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#E8E4DC] transition-colors hover:bg-[#3C2A1A]"
            >
              Sign in
            </Link>
            <Link
              to="/auth/register"
              className="w-full border border-[#C8C4BC] py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#3C2A1A] transition-colors hover:border-[#2C1A0E]"
            >
              Create an account
            </Link>
          </div>
          <a
            href={`https://wa.me/923268419823?text=${encodeURIComponent('Hi FabricPort — I have a question about a fabric.')}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9C8870] transition-colors hover:text-[#E8593C]"
          >
            Or message us on WhatsApp
          </a>
        </div>
      )}
    </div>
  )
}

export default SupportWidget
