import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_USD_TO_PKR = 278.5

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

    let rate = DEFAULT_USD_TO_PKR

    // Free, keyless provider by default; override with FX_API_URL if needed.
    const fxApiUrl = Deno.env.get('FX_API_URL') ?? 'https://open.er-api.com/v6/latest/USD'
    try {
      const response = await fetch(fxApiUrl)
      if (response.ok) {
        const payload = await response.json()
        const fetched = payload?.rates?.PKR ?? payload?.result ?? payload?.rate
        if (typeof fetched === 'number' && fetched > 0) {
          rate = fetched
        }
      }
    } catch {
      // Network failure → keep the fallback rate rather than erroring out.
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const { data, error } = await supabase
      .from('fx_rates')
      .upsert(
        {
          base: 'USD',
          target: 'PKR',
          rate,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: 'base,target' },
      )
      .select()
      .single()

    if (error) throw error

    return new Response(JSON.stringify({ ok: true, rate: data?.rate ?? rate }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
