import { useEffect, useRef, useState } from 'react'
import { LifeBuoy } from 'lucide-react'
import { dispatchNotification } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageInput } from '@/components/chat/MessageInput'
import type { SupportMessage } from '@/types/database.types'

export interface SupportThreadProps {
  /** The user the thread belongs to (buyer/supplier). */
  threadUserId: string
  /** The viewer writing messages (same as threadUserId, or an admin). */
  currentUserId: string
  /** True when the viewer is the admin side of the conversation. */
  isAdminView?: boolean
  className?: string
  emptyHint?: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SupportThread({
  threadUserId,
  currentUserId,
  isAdminView = false,
  className,
  emptyHint = 'No messages yet. Our team typically replies within a few hours.',
}: SupportThreadProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('user_id', threadUserId)
        .order('created_at', { ascending: true })

      if (!mounted) return
      if (error) console.error('Failed to load support thread:', error.message)
      setMessages(data ?? [])
      setLoading(false)
    }

    load()

    const channel = supabase
      .channel(`support:${threadUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `user_id=eq.${threadUserId}`,
        },
        (payload) => {
          const incoming = payload.new as SupportMessage
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
          )
        },
      )
      .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [threadUserId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark messages from the other party as read.
  useEffect(() => {
    const unread = messages.filter((m) => m.sender_id !== currentUserId && m.read_at == null)
    if (unread.length === 0) return
    const now = new Date().toISOString()
    unread.forEach((msg) => {
      void supabase.from('support_messages').update({ read_at: now }).eq('id', msg.id)
    })
  }, [messages, currentUserId])

  async function handleSend(content: string) {
    const { error } = await supabase.from('support_messages').insert({
      user_id: threadUserId,
      sender_id: currentUserId,
      content,
    })
    if (error) throw new Error(error.message)

    // Admin outreach pings the user across their channels.
    if (isAdminView) {
      dispatchNotification({
        userId: threadUserId,
        type: 'support_message',
        title: 'New message from the FabricPort team',
        body: content.length > 120 ? `${content.slice(0, 117)}…` : content,
      }).catch(() => undefined)
    }
  }

  return (
    <div className={cn('flex h-full min-h-[420px] flex-col overflow-hidden bg-card', className)}>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ml-auto h-12 w-1/2" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center">
            <LifeBuoy className="mx-auto h-8 w-8 text-text-muted" />
            <p className="mt-3 text-sm text-text-dark-secondary">{emptyHint}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const fromAdminSide = msg.sender_id !== threadUserId
            const isOwn = msg.sender_id === currentUserId
            return (
              <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[80%] px-4 py-2.5 text-sm clip-corner-sm',
                    isOwn
                      ? 'bg-accent text-white'
                      : 'border border-border-cream bg-card-hover text-text-dark',
                  )}
                >
                  {!isAdminView && fromAdminSide && (
                    <p className="mb-0.5 font-mono text-[9px] uppercase tracking-[0.18em] opacity-70">
                      FabricPort team
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p
                    className={cn(
                      'mt-1 font-mono text-[10px]',
                      isOwn ? 'text-white/70' : 'text-text-dark-secondary',
                    )}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <MessageInput
        onSend={handleSend}
        disabled={loading}
        placeholder={isAdminView ? 'Message this user…' : 'Ask the FabricPort team anything…'}
      />
    </div>
  )
}
