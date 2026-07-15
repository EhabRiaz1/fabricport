import { useRef, useState, type FormEvent } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ATTACHMENT_HINT, validateAttachment } from '@/lib/attachments'

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
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function addFiles(selected: FileList | null) {
    if (!selected) return
    const next: File[] = []
    for (const file of Array.from(selected)) {
      const reason = validateAttachment(file)
      if (reason) {
        setFileError(reason)
        continue
      }
      next.push(file)
    }
    if (next.length) {
      setFileError(null)
      setFiles((prev) => [...prev, ...next])
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = content.trim()
    if ((!trimmed && files.length === 0) || sending || disabled) return

    setSending(true)
    try {
      await onSend(trimmed, files.length ? files : undefined)
      setContent('')
      setFiles([])
      setFileError(null)
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

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 border border-border-cream bg-card-hover px-2 py-1.5 font-mono text-[11px] text-text-dark clip-corner-sm"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${file.name}`}
                className="shrink-0 text-text-dark-secondary hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {fileError && <p className="font-mono text-[11px] text-danger">{fileError}</p>}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            disabled={disabled || sending}
            onChange={(e) => addFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || sending}
            className="text-text-dark-secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            Attach
          </Button>
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
            {ATTACHMENT_HINT}
          </span>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={disabled || sending || (!content.trim() && files.length === 0)}
        >
          <Send className="h-4 w-4" />
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </form>
  )
}
