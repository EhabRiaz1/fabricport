import { useState } from 'react'
import { Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAttachmentUrl } from '@/lib/attachments'
import type { MessageAttachment } from '@/types/database.types'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface AttachmentListProps {
  attachments: MessageAttachment[]
  /** `own` = accent message bubble (light text); `default` = cream surface. */
  variant?: 'own' | 'default'
  className?: string
}

/**
 * Renders message attachments as chips. The bucket is private, so each chip
 * fetches a short-lived signed URL on click rather than holding a public URL.
 */
export function AttachmentList({ attachments, variant = 'default', className }: AttachmentListProps) {
  const [busy, setBusy] = useState<string | null>(null)

  if (!attachments?.length) return null

  async function open(path: string) {
    setBusy(path)
    try {
      const url = await getAttachmentUrl(path)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setBusy(null)
    }
  }

  return (
    <ul className={cn('mt-2 space-y-1', className)}>
      {attachments.map((att) => (
        <li key={att.path}>
          <button
            type="button"
            onClick={() => open(att.path)}
            disabled={busy === att.path}
            className={cn(
              'flex w-full items-center gap-2 border px-2 py-1.5 text-left font-mono text-[11px] transition-colors clip-corner-sm',
              variant === 'own'
                ? 'border-white/30 text-white/90 hover:bg-white/10'
                : 'border-border-cream text-text-dark hover:bg-card-hover',
            )}
          >
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{att.name}</span>
            <span className="shrink-0 opacity-60">{formatSize(att.size)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export default AttachmentList
