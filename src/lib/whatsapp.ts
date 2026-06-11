const WHATSAPP_ENABLED = import.meta.env.VITE_ENABLE_WHATSAPP === 'true'

export interface SendWhatsAppInput {
  to: string
  template: string
  variables?: Record<string, string>
  userId?: string
}

export interface SendWhatsAppResult {
  ok: boolean
  skipped?: boolean
  messageId?: string
  error?: string
}

export function isWhatsAppEnabled(): boolean {
  return (
    WHATSAPP_ENABLED &&
    Boolean(import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN) &&
    Boolean(import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID)
  )
}

export async function sendWhatsAppMessage(
  input: SendWhatsAppInput,
): Promise<SendWhatsAppResult> {
  if (!isWhatsAppEnabled()) {
    return { ok: true, skipped: true }
  }

  const accessToken = import.meta.env.VITE_WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = import.meta.env.VITE_WHATSAPP_PHONE_NUMBER_ID

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: input.to.replace(/\D/g, ''),
          type: 'template',
          template: {
            name: input.template,
            language: { code: 'en' },
            components: input.variables
              ? [
                  {
                    type: 'body',
                    parameters: Object.values(input.variables).map((value) => ({
                      type: 'text',
                      text: value,
                    })),
                  },
                ]
              : undefined,
          },
        }),
      },
    )

    if (!response.ok) {
      const message = await response.text()
      return { ok: false, error: message || response.statusText }
    }

    const payload = (await response.json()) as {
      messages?: Array<{ id?: string }>
    }

    return { ok: true, messageId: payload.messages?.[0]?.id }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown WhatsApp error',
    }
  }
}
