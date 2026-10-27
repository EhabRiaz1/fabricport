import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Refreshes the USD→PKR rate in `fx_rates`.
 *
 * Callers: an admin pressing Refresh in /admin/settings (user JWT), or the daily
 * pg_cron job (X-Cron-Secret header matching the CRON_SECRET function secret).
 *
 * A failed fetch is reported as an error and leaves the stored rate untouched.
 * The previous version silently wrote a hardcoded 278.5 with a fresh timestamp,
 * which made outages look like successful refreshes.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables')
    }
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // --- Authorise: cron secret, or an admin session ---
    const cronSecret = Deno.env.get('CRON_SECRET')
    const suppliedSecret = req.headers.get('x-cron-secret')
    let authorised = Boolean(cronSecret && suppliedSecret && suppliedSecret === cronSecret)

    if (!authorised) {
      const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
      if (token) {
        const { data: userData } = await admin.auth.getUser(token)
        if (userData?.user) {
          const { data: profile } = await admin
            .from('profiles')
            .select('role')
            .eq('id', userData.user.id)
            .maybeSingle()
          authorised = profile?.role === 'admin'
        }
      }
    }
    if (!authorised) return json({ ok: false, error: 'Admin access required' }, 403)

    // --- Fetch ---
    const fxApiUrl = Deno.env.get('FX_API_URL') ?? 'https://open.er-api.com/v6/latest/USD'
    const response = await fetch(fxApiUrl)
    if (!response.ok) {
      return json({ ok: false, error: `Rate provider returned ${response.status}` }, 502)
    }
    const payload = await response.json()
    const fetched = payload?.rates?.PKR ?? payload?.result ?? payload?.rate
    if (typeof fetched !== 'number' || !(fetched > 0)) {
      return json({ ok: false, error: 'Rate provider returned no PKR rate' }, 502)
    }
    const rate = Math.round(fetched * 10000) / 10000

    const { data, error } = await admin
      .from('fx_rates')
      .upsert(
        { base: 'USD', target: 'PKR', rate, fetched_at: new Date().toISOString() },
        { onConflict: 'base,target' },
      )
      .select()
      .single()
    if (error) throw error

    return json({ ok: true, rate: data?.rate ?? rate })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ ok: false, error: message }, 500)
  }
})
