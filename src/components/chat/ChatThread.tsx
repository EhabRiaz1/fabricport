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

/**
 * A thread hangs off exactly one parent — an inquiry or a sample request —
 * mirroring the messages_exactly_one_thread CHECK constraint. Pass exactly one.
 */
export type ChatThreadProps = {
  currentUserId: string
  readOnly?: boolean
  className?: string
  /** Slim the composer for the docked panel. */
  compact?: boolean
  /** Opening line to seed the composer with, unsent. */
  prefill?: string
  /** Counterpart to notify (WhatsApp/email/in-app) when a message is sent. */
  notifyUserId?: string
  /** Short sender label used in the notification copy. */
  notifyFromLabel?: string
} & (
  | { inquiryId: string; sampleRequestId?: never }
  | { sampleRequestId: string; inquiryId?: never }
)

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
  sampleRequestId,
  currentUserId,
  readOnly = false,
  className,
  compact = false,
  prefill,
  notifyUserId,
  notifyFromLabel,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // The four places this component was bound to inquiries: the load filter, the
  // two realtime filters (+ channel name), the storage prefix, and the insert
  // payload. All four now derive from whichever parent was passed.
  const isSample = sampleRequestId != null
  const threadColumn = isSample ? 'sample_request_id' : 'inquiry_id'
  const threadId = (isSample ? sampleRequestId : inquiryId) as string
  const storagePrefix = isSample ? `sample/${threadId}` : `inquiry/${threadId}`

  useEffect(() => {
    let mounted = true

    async function loadMessages() {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq(threadColumn, threadId)
        .order('created_at', { ascending: true })

      if (!mounted) return
      if (error) console.error('Failed to load messages:', error.message)
      setMessages(data ?? [])
      setLoading(false)
    }

    loadMessages()

    const channel = supabase
      .channel(`messages:${threadColumn}:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `${threadColumn}=eq.${threadId}`,
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
          filter: `${threadColumn}=eq.${threadId}`,
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
  }, [threadColumn, threadId])

  useEffect(() => {
    // Scroll the list, not the page -- scrollIntoView walks up to the document scroller.
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (nearBottom || messages.length === 0) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(() => {
    const unread = messages.filter(
      (m) => m.sender_id !== currentUserId && m.read_at == null,
    )
    if (unread.length === 0) return

    // One statement, not one per message. Same rows the policy already permits.
    void supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq(threadColumn, threadId)
      .neq('sender_id', currentUserId)
      .is('read_at', null)
  }, [messages, currentUserId, threadColumn, threadId])

  async function handleSend(content: string, files?: File[]) {
    const attachments = files?.length ? await uploadAttachments(files, storagePrefix) : []

    const { error } = await supabase.from('messages').insert({
      inquiry_id: isSample ? null : threadId,
      sample_request_id: isSample ? threadId : null,
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
        data: isSample ? { sample_request_id: threadId } : { inquiry_id: threadId },
      }).catch(() => undefined)
    }
  }

  return (
    <div className={cn('flex h-full min-h-[420px] flex-col overflow-hidden bg-card', className)}>
      <div
        ref={scrollRef}
        data-lenis-prevent
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
      >
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
      </div>

      {!readOnly && (
        <MessageInput
          onSend={handleSend}
          disabled={loading}
          compact={compact}
          // Only seed an empty conversation. Reopening a thread that already has history
          // should not push a canned opener into it.
          prefill={messages.length === 0 ? prefill : undefined}
        />
      )}
    </div>
  )
}
