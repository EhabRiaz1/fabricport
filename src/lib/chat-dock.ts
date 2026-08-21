import { create } from 'zustand'

/**
 * What the docked chat is currently showing.
 *
 *  - `menu`    nothing open; the launcher is idle
 *  - `list`    the reader's conversations, newest first
 *  - `thread`  one inquiry conversation with a supplier (or buyer)
 *  - `support` the FabricPort sourcing team
 */
export type ChatDockView = 'menu' | 'list' | 'thread' | 'support'

interface ChatDockState {
  open: boolean
  view: ChatDockView
  /** Set when view is 'thread'. */
  inquiryId: string | null
  /** Shown in the header while the thread's own row is still loading. */
  title: string | null
  /** Unsent opening line for a conversation that has just been started. */
  draft: string | null

  openList: () => void
  openSupport: () => void
  openThread: (inquiryId: string, title?: string, draft?: string) => void
  back: () => void
  close: () => void
}

/**
 * Open state for the docked chat.
 *
 * A store rather than local state because several unrelated places raise it: the launcher,
 * the footer, and "Inquire now" on a fabric page -- which opens the new conversation in the
 * dock instead of navigating the reader away from the fabric they were looking at.
 */
export const useChatDock = create<ChatDockState>((set) => ({
  open: false,
  view: 'menu',
  inquiryId: null,
  title: null,
  draft: null,

  openList: () => set({ open: true, view: 'list', inquiryId: null, title: null, draft: null }),
  openSupport: () => set({ open: true, view: 'support', inquiryId: null, title: null, draft: null }),
  openThread: (inquiryId, title, draft) =>
    set({ open: true, view: 'thread', inquiryId, title: title ?? null, draft: draft ?? null }),
  back: () => set({ view: 'list', inquiryId: null, title: null, draft: null }),
  close: () => set({ open: false }),
}))
