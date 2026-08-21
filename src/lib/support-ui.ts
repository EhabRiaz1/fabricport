import { create } from 'zustand'

/**
 * Open/closed state for the floating support widget.
 *
 * A store rather than local state because more than one place raises it: the launcher
 * bubble, and the footer's "Chat with the team" link -- which is the widget's second entry
 * point for anyone who scrolls past the bubble without noticing it.
 */
interface SupportUIState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useSupportUI = create<SupportUIState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
