import { supabase } from '@/lib/supabase'
import type { MessageAttachment } from '@/types/database.types'

export const ATTACHMENTS_BUCKET = 'message-attachments'
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024 // 20 MB (matches the bucket limit)

export const ALLOWED_ATTACHMENT_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export const ATTACHMENT_HINT = 'PDF, images, CSV, XLSX, DOCX — max 20 MB'

/** Human-readable rejection reason, or null if the file is acceptable. */
export function validateAttachment(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name} is larger than 20 MB`
  if (!ALLOWED_ATTACHMENT_MIME.includes(file.type as (typeof ALLOWED_ATTACHMENT_MIME)[number])) {
    return `${file.name} is not an accepted file type`
  }
  return null
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
}

/**
 * Upload files to the private message-attachments bucket under the given path
 * prefix (e.g. `inquiry/<id>` or `support/<userId>`) and return attachment
 * records for storage on the message row. Throws on the first failed upload.
 */
export async function uploadAttachments(
  files: File[],
  prefix: string,
): Promise<MessageAttachment[]> {
  const out: MessageAttachment[] = []
  for (const file of files) {
    const path = `${prefix}/${crypto.randomUUID()}-${sanitize(file.name)}`
    const { error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error(`Upload failed for ${file.name}: ${error.message}`)
    out.push({ name: file.name, path, size: file.size, type: file.type })
  }
  return out
}

/** Short-lived signed URL for a private attachment (null on failure). */
export async function getAttachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path, 60 * 60) // 1 hour
  if (error) return null
  return data?.signedUrl ?? null
}
