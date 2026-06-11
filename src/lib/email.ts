const EMAIL_ENABLED = import.meta.env.VITE_ENABLE_EMAIL === 'true'

export interface SendEmailInput {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}

export interface SendEmailResult {
  ok: boolean
  skipped?: boolean
  id?: string
  error?: string
}

export function isEmailEnabled(): boolean {
  return EMAIL_ENABLED && Boolean(import.meta.env.VITE_RESEND_API_KEY)
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailEnabled()) {
    return { ok: true, skipped: true }
  }

  const apiKey = import.meta.env.VITE_RESEND_API_KEY
  const from = input.from ?? 'FabricPort <noreply@fabricport.com>'

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        reply_to: input.replyTo,
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      return { ok: false, error: message || response.statusText }
    }

    const payload = (await response.json()) as { id?: string }
    return { ok: true, id: payload.id }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown email error',
    }
  }
}
