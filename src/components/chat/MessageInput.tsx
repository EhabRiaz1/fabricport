import { useRef, useState, type FormEvent } from 'react'
import { Paperclip, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export interface MessageInputProps {
  onSend: (content: string, attachments?: File[]) => Promise<void>
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Type a message…',
  className,
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if (!trimmed || sending || disabled) return

    setSending(true)
    try {
      await onSend(trimmed)
      setContent('')
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex flex-col gap-2 border-t border-border-cream bg-card p-4', className)}
    >
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || sending}
        className="min-h-[80px] border-border-cream bg-card-hover text-text-dark"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            void handleSubmit(e)
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" className="hidden" multiple disabled />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled
            className="text-text-dark-secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            Attach
          </Button>
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
            Attachments coming soon
          </span>
        </div>
        <Button type="submit" size="sm" disabled={disabled || sending || !content.trim()}>
          <Send className="h-4 w-4" />
          Send
        </Button>
      </div>
    </form>
  )
}
