import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, LifeBuoy, MessageCircle, MessagesSquare, X } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ChatThread } from '@/components/chat/ChatThread'
import { SupportThread } from '@/components/chat/SupportThread'
import { CountBadge } from '@/components/shared/CountBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useSupportUnread } from '@/hooks/useSupportUnread'
import { useChatThreads } from '@/hooks/useChatThreads'
import { useChatDock } from '@/lib/chat-dock'
import { useCartUI } from '@/lib/cart'
import { cn } from '@/lib/utils'

/**
 * Docked messaging, in the manner of LinkedIn's.
 *
 * This is the conversation surface for the whole marketplace, not just a support box:
 * "Inquire now" on a fabric opens the resulting supplier conversation right here rather than
 * throwing the reader into the portal, so they keep their place on the page they were
 * reading. Support is one of the conversations available, not the purpose of the thing.
 *
 * The launcher is a plain circle. Hovering it fans out the two ways in -- your conversations,
 * or the sourcing team -- so the common case (open my messages) is one click and the choice
 * is still discoverable. Focus opens the same fan, so it is reachable from the keyboard.
 */

/** The portals have their own inbox pages, and auth screens want no distractions. */
const HIDDEN_ROUTES = /^\/(buyer|supplier-portal|admin|auth)/

const WHATSAPP_HREF = `https://wa.me/923268419823?text=${encodeURIComponent(
  'Hi FabricPort — I have a question about a fabric.',
)}`

export function ChatDock() {
  const { pathname } = useLocation()
  const { isAuthenticated, user, role } = useAuth()
  const open = useChatDock((s) => s.open)
  const view = useChatDock((s) => s.view)
  const inquiryId = useChatDock((s) => s.inquiryId)
  const title = useChatDock((s) => s.title)
  const openList = useChatDock((s) => s.openList)
  const openSupport = useChatDock((s) => s.openSupport)
  const back = useChatDock((s) => s.back)
  const close = useChatDock((s) => s.close)

  const cartOpen = useCartUI((s) => s.open)
  const [fanOpen, setFanOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const reduced = useReducedMotion()

  // Only counts while the panel is shut -- reading them is what clears them.
  const { unread, clear } = useSupportUnread(open || !isAuthenticated ? null : (user?.id ?? null))

  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)')
    const sync = () => setIsDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (open) clear()
    // `clear` is a new closure each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Don't let the panel trail the reader across the site.
  useEffect(() => {
    close()
    setFanOpen(false)
  }, [pathname, close])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (HIDDEN_ROUTES.test(pathname)) return null

  const canMessage = isAuthenticated && (role === 'buyer' || role === 'supplier')
  const panel = <DockPanel />

  const fanItems = [
    ...(canMessage
      ? [{ key: 'chats', label: 'Go to chats', icon: MessagesSquare, onSelect: openList }]
      : []),
    { key: 'support', label: 'Chat with support', icon: LifeBuoy, onSelect: openSupport },
  ]

  const launcher = (
    <div
      // The fan is part of the launcher's own hover target, so moving the pointer up onto an
      // option does not count as leaving.
      onPointerEnter={() => setFanOpen(true)}
      onPointerLeave={() => setFanOpen(false)}
      onFocus={() => setFanOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setFanOpen(false)
      }}
      className="fixed right-5 z-40 flex flex-col items-end gap-2"
      style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      <AnimatePresence>
        {fanOpen && !open && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: reduced ? 0.12 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-end gap-2"
          >
            {fanItems.map((item, index) => (
              <motion.button
                key={item.key}
                type="button"
                onClick={() => {
                  item.onSelect()
                  setFanOpen(false)
                }}
                initial={reduced ? undefined : { opacity: 0, y: 6, scale: 0.96 }}
                animate={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
                transition={{
                  // Nearest the launcher arrives first, so the fan reads as unfolding from it.
                  delay: reduced ? 0 : (fanItems.length - 1 - index) * 0.045,
                  duration: 0.18,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="clip-corner-sm flex items-center gap-2 border border-[#C8C4BC] bg-[#F6F1E9] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#2C1A0E] shadow-[0_8px_24px_-10px_rgba(26,14,6,0.5)] transition-colors hover:border-[#2C1A0E]"
              >
                <item.icon className="h-3.5 w-3.5 text-[#7A4A28]" />
                {item.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => (open ? close() : canMessage ? openList() : openSupport())}
        aria-label={open ? 'Close messages' : 'Messages'}
        aria-expanded={open}
        className="relative grid h-12 w-12 place-items-center rounded-full bg-[#2C1A0E] text-[#F5EDE4] shadow-[0_10px_30px_-8px_rgba(26,14,6,0.55)] transition-colors hover:bg-[#3C2A1A]"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && <CountBadge count={unread} className="absolute -right-1 -top-1 rounded-full" />}
      </button>
    </div>
  )

  return (
    <>
      {/* Hidden while the cart drawer is open rather than stacked under it. */}
      {!cartOpen && createPortal(launcher, document.body)}

      {isDesktop
        ? createPortal(
            <AnimatePresence>
              {open && (
                <motion.div
                  role="dialog"
                  aria-label="Messages"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: reduced ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
                  // No overlay: a dock is not a modal, and the page stays usable behind it.
                  className="clip-corner fixed right-5 z-[55] flex w-[380px] flex-col overflow-hidden border border-[#C8C4BC] bg-[#F6F1E9] shadow-[0_24px_70px_-18px_rgba(26,14,6,0.45)]"
                  style={{
                    bottom: 'calc(max(1.25rem, env(safe-area-inset-bottom)) + 3.75rem)',
                    height: view === 'menu' ? 'auto' : 'min(560px, calc(100dvh - 140px))',
                    maxHeight: 'calc(100dvh - 140px)',
                  }}
                >
                  {panel}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )
        : (
            <Sheet open={open} onOpenChange={(next) => (next ? openList() : close())}>
              <SheetContent
                side="bottom"
                showClose={false}
                aria-label="Messages"
                aria-describedby={undefined}
                className="h-[92dvh] max-w-none bg-[#F6F1E9] p-0"
              >
                {panel}
              </SheetContent>
            </Sheet>
          )}
    </>
  )

  function DockPanel() {
    const heading =
      view === 'support' ? 'FabricPort support' : view === 'thread' ? (title ?? 'Conversation') : 'Messages'
    const sub =
      view === 'support'
        ? 'Sourcing team · replies in a few hours'
        : view === 'thread'
          ? 'Inquiry conversation'
          : 'Your conversations'

    return (
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex items-center gap-2 border-b border-[#C8C4BC] px-3 py-3">
          {view === 'thread' && (
            <button
              type="button"
              onClick={back}
              aria-label="Back to conversations"
              className="grid h-8 w-8 shrink-0 place-items-center text-[#3C2A1A]/55 transition-colors hover:text-[#2C1A0E]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1 px-1">
            <p className="truncate font-display text-sm font-semibold tracking-tight text-[#2C1A0E]">
              {heading}
            </p>
            <p className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-[#9C8870]">
              {sub}
            </p>
          </div>
          {view !== 'support' && canMessage && (
            <button
              type="button"
              onClick={openSupport}
              aria-label="Chat with support"
              title="Chat with support"
              className="grid h-8 w-8 shrink-0 place-items-center text-[#3C2A1A]/55 transition-colors hover:text-[#2C1A0E]"
            >
              <LifeBuoy className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center text-[#3C2A1A]/55 transition-colors hover:text-[#2C1A0E]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {!isAuthenticated ? (
          <SignedOutPanel />
        ) : view === 'support' && user ? (
          <SupportThread
            threadUserId={user.id}
            currentUserId={user.id}
            compact
            className="h-full min-h-0 flex-1 bg-transparent"
          />
        ) : view === 'thread' && inquiryId && user ? (
          <ChatThread
            inquiryId={inquiryId}
            currentUserId={user.id}
            compact
            className="h-full min-h-0 flex-1 bg-transparent"
          />
        ) : (
          <ThreadList />
        )}
      </div>
    )
  }

  function ThreadList() {
    const openThread = useChatDock((s) => s.openThread)
    const { threads, loading } = useChatThreads(open && view === 'list')

    if (!canMessage) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <p className="text-sm text-[#3C2A1A]/70">
            Conversations live on buyer and supplier accounts.
          </p>
          <button
            type="button"
            onClick={openSupport}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#E8593C] hover:opacity-70"
          >
            Chat with support instead
          </button>
        </div>
      )
    }

    if (loading) {
      return (
        <div className="flex-1 space-y-2 p-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )
    }

    if (threads.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-12 text-center">
          <MessagesSquare className="h-7 w-7 text-[#9C8870]" />
          <p className="font-display text-base font-semibold tracking-tight text-[#2C1A0E]">
            No conversations yet
          </p>
          <p className="text-xs leading-relaxed text-[#3C2A1A]/60">
            Use <span className="text-[#2C1A0E]">Inquire now</span> on a fabric to start talking
            to its mill.
          </p>
        </div>
      )
    }

    return (
      <ul className="min-h-0 flex-1 divide-y divide-[#C8C4BC]/60 overflow-y-auto overscroll-contain">
        {threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => openThread(thread.id, thread.counterpartName)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#EFE9DC]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#E8E2D2] font-mono text-[11px] text-[#7A4A28]">
                {thread.counterpartName.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-[#2C1A0E]">
                  {thread.counterpartName}
                </span>
                <span className="block truncate font-mono text-[9px] uppercase tracking-[0.14em] text-[#9C8870]">
                  {thread.itemCount} fabric{thread.itemCount === 1 ? '' : 's'} · {thread.status}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    )
  }

  function SignedOutPanel() {
    return (
      <div className="flex flex-1 flex-col justify-center gap-5 px-6 py-8 text-center">
        <p className="text-sm leading-relaxed text-[#3C2A1A]/75">
          Sign in to message mills directly about MOQ, lead times and shipping — or ask our
          sourcing team.
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
          href={WHATSAPP_HREF}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'font-mono text-[10px] uppercase tracking-[0.16em] text-[#9C8870]',
            'transition-colors hover:text-[#E8593C]',
          )}
        >
          Or message us on WhatsApp
        </a>
      </div>
    )
  }
}

export default ChatDock
