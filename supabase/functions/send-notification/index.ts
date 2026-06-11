import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationRequest {
  userId: string
  type: string
  title: string
  body?: string
  data?: Record<string, unknown>
  /** Override per-channel behaviour; defaults to user preferences. */
  channels?: { whatsapp?: boolean; email?: boolean }
}

interface ChannelPrefs {
  email: boolean
  whatsapp: boolean
  in_app: boolean
}

const DEFAULT_PREFS: ChannelPrefs = { email: true, whatsapp: true, in_app: true }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Send a WhatsApp text via Twilio. Returns null when not configured. */
async function sendWhatsApp(
  to: string,
  text: string,
): Promise<{ ok: boolean; sid?: string; error?: string } | null> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM') // e.g. "whatsapp:+14155238886"
  if (!accountSid || !authToken || !from) return null

  const normalized = to.startsWith('whatsapp:') ? to : `whatsapp:${to.replace(/[^\d+]/g, '')}`

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ From: from, To: normalized, Body: text }),
      },
    )
    const payload = await res.json()
    if (!res.ok) {
      return { ok: false, error: payload?.message ?? res.statusText }
    }
    return { ok: true, sid: payload?.sid }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Twilio error' }
  }
}

/** Send an email via Resend. Returns null when not configured. */
async function sendEmail(
  to: string,
  subject: string,
  text: string,
): Promise<{ ok: boolean; error?: string } | null> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM') ?? 'FabricPort <notifications@fabricport.com>'
  if (!apiKey) return null

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
      }),
    })
    if (!res.ok) {
      const payload = await res.text()
      return { ok: false, error: payload || res.statusText }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Resend error' }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const payload = (await req.json()) as NotificationRequest
    if (!payload.userId || !payload.type || !payload.title) {
      return json({ ok: false, error: 'userId, type and title are required' }, 400)
    }

    // 1. In-app notification (drives the realtime bell)
    const { data: notification, error: insertError } = await admin
      .from('notifications')
      .insert({
        user_id: payload.userId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? null,
        data: payload.data ?? null,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // 2. Resolve recipient contact details and preferences
    const [{ data: profile }, { data: supplier }, { data: authUser }] = await Promise.all([
      admin
        .from('profiles')
        .select('whatsapp_numbers, full_name, role')
        .eq('id', payload.userId)
        .maybeSingle(),
      admin
        .from('suppliers')
        .select('notification_settings')
        .eq('id', payload.userId)
        .maybeSingle(),
      admin.auth.admin.getUserById(payload.userId),
    ])

    const prefsMap = (supplier?.notification_settings ?? {}) as Record<string, ChannelPrefs>
    const prefs = prefsMap[payload.type] ?? DEFAULT_PREFS

    const wantWhatsapp = payload.channels?.whatsapp ?? prefs.whatsapp
    const wantEmail = payload.channels?.email ?? prefs.email

    const results: Record<string, unknown> = { in_app: true }

    // 3. WhatsApp fan-out
    const whatsappNumbers = (profile?.whatsapp_numbers ?? []) as {
      number: string
      primary?: boolean
    }[]
    const primaryWa =
      whatsappNumbers.find((n) => n.primary)?.number ?? whatsappNumbers[0]?.number

    if (wantWhatsapp && primaryWa) {
      const text = `${payload.title}${payload.body ? `\n\n${payload.body}` : ''}\n\n— FabricPort`
      const waResult = await sendWhatsApp(primaryWa, text)
      if (waResult === null) {
        results.whatsapp = 'not_configured'
      } else {
        results.whatsapp = waResult.ok ? 'sent' : `failed: ${waResult.error}`
        await admin.from('whatsapp_log').insert({
          user_id: payload.userId,
          phone_number: primaryWa,
          template: payload.type,
          variables: { title: payload.title, body: payload.body ?? null },
          status: waResult.ok ? 'sent' : 'failed',
          wa_message_id: waResult.sid ?? null,
        })
      }
    } else {
      results.whatsapp = wantWhatsapp ? 'no_number' : 'disabled'
    }

    // 4. Email fan-out
    const email = authUser?.data?.user?.email
    if (wantEmail && email) {
      const emailResult = await sendEmail(
        email,
        payload.title,
        `${payload.body ?? payload.title}\n\nOpen your FabricPort portal to respond.`,
      )
      results.email =
        emailResult === null
          ? 'not_configured'
          : emailResult.ok
            ? 'sent'
            : `failed: ${emailResult.error}`
    } else {
      results.email = wantEmail ? 'no_email' : 'disabled'
    }

    return json({ ok: true, notification, results })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ ok: false, error: message }, 500)
  }
})
