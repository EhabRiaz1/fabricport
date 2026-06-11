import { supabase } from '@/lib/supabase'
import type { Json, Notification } from '@/types/database.types'
import type { NotificationPayload } from '@/types/app'

export interface CreateNotificationInput {
  userId: string
  type: string
  title: string
  body?: string
  data?: NotificationPayload & Record<string, Json | undefined>
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      data: (input.data ?? null) as Json | null,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`)
  }

  return data
}

export async function dispatchNotification(input: CreateNotificationInput): Promise<void> {
  const { error } = await supabase.functions.invoke('send-notification', {
    body: input,
  })

  if (error) {
    throw new Error(`Failed to dispatch notification: ${error.message}`)
  }
}
