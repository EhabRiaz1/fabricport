import { useEffect, useRef, useState } from 'react'
import { Check, CheckCheck } from 'lucide-react'
import { dispatchNotification } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageInput } from '@/components/chat/MessageInput'
import { AttachmentList } from '@/components/chat/AttachmentList'
import { uploadAttachments } from '@/lib/attachments'
import type { Message } from '@/types/database.types'

export interface ChatThreadProps {
  inquiryId: string
  currentUserId: string
  readOnly?: boolean
  className?: string
  /** Counterpart to notify (WhatsApp/email/in-app) when a message is sent. */
  notifyUserId?: string
  /** Short sender label used in the notification copy. */
  notifyFromLabel?: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ChatThread({
  inquiryId,
  currentUserId,
  readOnly = false,
  className,
  notifyUserId,
  notifyFromLabel,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mounted = true

    async function loadMessages() {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('inquiry_id', inquiryId)
        .order('created_at', { ascending: true })

      if (!mounted) return
      if (error) console.error('Failed to load messages:', error.message)
      setMessages(data ?? [])
      setLoading(false)
    }

    loadMessages()

    const channel = supabase
      .channel(`messages:${inquiryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `inquiry_id=eq.${inquiryId}`,
        },
        (payload) => {
          const incoming = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev
            return [...prev, incoming]
          })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `inquiry_id=eq.${inquiryId}`,
        },
        (payload) => {
          const updated = payload.new as Message
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        },
      )
      .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [inquiryId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const unread = messages.filter(
      (m) => m.sender_id !== currentUserId && m.read_at == null,
    )
    if (unread.length === 0) return

    const now = new Date().toISOString()
    unread.forEach((msg) => {
      void supabase.from('messages').update({ read_at: now }).eq('id', msg.id)
    })
  }, [messages, currentUserId])

  async function handleSend(content: string, files?: File[]) {
    const attachments = files?.length
      ? await uploadAttachments(files, `inquiry/${inquiryId}`)
      : []

    const { error } = await supabase.from('messages').insert({
      inquiry_id: inquiryId,
      sender_id: currentUserId,
      content,
      attachments,
    })
    if (error) throw new Error(error.message)

    if (notifyUserId) {
      const preview = content
        ? content.length > 120
          ? `${content.slice(0, 117)}…`
          : content
        : `Sent ${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`
      dispatchNotification({
        userId: notifyUserId,
        type: 'message_received',
        title: `New message${notifyFromLabel ? ` from ${notifyFromLabel}` : ''}`,
        body: preview,
        data: { inquiry_id: inquiryId },
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
          <p className="py-8 text-center text-sm text-text-dark-secondary">
            No messages yet. Start the conversation.
          </p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId
            return (
              <div
                key={msg.id}
                className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] px-4 py-2.5 text-sm',
                    isOwn
                      ? 'bg-accent text-white clip-corner-sm'
                      : 'border border-border-cream bg-card-hover text-text-dark clip-corner-sm',
                  )}
                >
                  {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                  {msg.attachments?.length > 0 && (
                    <AttachmentList
                      attachments={msg.attachments}
                      variant={isOwn ? 'own' : 'default'}
                    />
                  )}
                  <div
                    className={cn(
                      'mt-1 flex items-center gap-1 font-mono text-[10px]',
                      isOwn ? 'text-white/70' : 'text-text-dark-secondary',
                    )}
                  >
                    <span>{formatTime(msg.created_at)}</span>
                    {isOwn &&
                      (msg.read_at ? (
                        <CheckCheck className="h-3 w-3" />
                      ) : (
                        <Check className="h-3 w-3" />
                      ))}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {!readOnly && (
        <MessageInput onSend={handleSend} disabled={loading} />
      )}
    </div>
  )
}
