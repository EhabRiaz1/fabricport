import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import type { Notification, UserRole } from '@/types/database.types'
import type { NotificationPayload } from '@/types/app'

export interface NotificationBellProps {
  className?: string
}

/**
 * Notifications go to buyers, suppliers and admins alike, so the destination
 * depends on WHO is reading. This used to hard-code the buyer path for every
 * role, which sent a supplier to /buyer/inquiries/... and got them bounced
 * straight back out by AuthGuard's zone check.
 */
function getNotificationHref(
  data: NotificationPayload | null,
  role: UserRole | null,
): string | null {
  if (!data) return null

  if (data.inquiry_id) {
    if (role === 'supplier') return `/supplier-portal/inquiries/${data.inquiry_id}`
    if (role === 'admin') return `/admin/inquiries/${data.inquiry_id}`
    return `/buyer/inquiries/${data.inquiry_id}`
  }
  if (data.sample_request_id) {
    if (role === 'supplier') return `/supplier-portal/samples/${data.sample_request_id}`
    return `/buyer/samples/${data.sample_request_id}`
  }
  // Was `/admin/invoices/:id`, a route that never existed — the admin catch-all
  // silently swallowed it. Admin billing is a single list, buyers get the invoice.
  if (data.invoice_id) {
    if (role === 'admin') return '/admin/billing'
    if (role === 'supplier') return `/supplier-portal/inquiries`
    return `/buyer/invoices/${data.invoice_id}`
  }
  // listing_request_id is dispatched by the admin listing pipeline and read by
  // the supplier; the old two-segment /supplier/listing-requests/:id matched no
  // route at all and fell through to the global catch-all.
  if (data.listing_request_id) return '/supplier-portal/listing-request'
  if (data.product_id) return `/fabric/${data.product_id}`
  return null
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { user, role } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read_at).length

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false

    async function loadNotifications() {
      setLoading(true)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!cancelled) {
        if (!error && data) {
          setNotifications(data)
        }
        setLoading(false)
      }
    }

    void loadNotifications()

    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 20))
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  async function markAsRead(id: string) {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    )
  }

  if (!user) return null

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        aria-label="Notifications"
        className="relative rounded-sm p-2 text-text-secondary transition-colors hover:text-accent"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 border border-border bg-surface shadow-xl clip-corner-sm">
            <div className="border-b border-border px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Notifications
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading && (
                <p className="px-4 py-6 text-sm text-text-muted">Loading...</p>
              )}

              {!loading && notifications.length === 0 && (
                <p className="px-4 py-6 text-sm text-text-muted">No notifications yet.</p>
              )}

              {notifications.map((notification) => {
                const href = getNotificationHref(
                  notification.data as NotificationPayload | null,
                  role,
                )
                const content = (
                  <div
                    className={cn(
                      'px-4 py-3 transition-colors hover:bg-elevated',
                      !notification.read_at && 'border-l-2 border-accent',
                    )}
                  >
                    <p className="text-sm font-medium text-text-primary">{notification.title}</p>
                    {notification.body && (
                      <p className="mt-1 text-xs text-text-secondary line-clamp-2">
                        {notification.body}
                      </p>
                    )}
                  </div>
                )

                if (href) {
                  return (
                    <Link
                      key={notification.id}
                      to={href}
                      onClick={() => {
                        markAsRead(notification.id)
                        setOpen(false)
                      }}
                    >
                      {content}
                    </Link>
                  )
                }

                return (
                  <button
                    key={notification.id}
                    type="button"
                    className="block w-full text-left"
                    onClick={() => markAsRead(notification.id)}
                  >
                    {content}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default NotificationBell
