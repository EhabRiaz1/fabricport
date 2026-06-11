import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Action = 'list' | 'create' | 'reset_password' | 'set_status' | 'delete'

interface AdminUsersRequest {
  action: Action
  userId?: string
  email?: string
  role?: 'admin' | 'supplier' | 'buyer'
  fullName?: string
  companyName?: string
  brandName?: string
  whatsapp?: string
  status?: 'active' | 'suspended' | 'pending'
  verifySupplier?: boolean
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function generateTempPassword(): string {
  // Readable but strong: Fp-XXXX-XXXX with mixed alphanumerics
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const pick = (n: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((b) => alphabet[b % alphabet.length])
      .join('')
  return `Fp-${pick(4)}-${pick(4)}`
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
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

    // --- Authenticate caller and require admin role ---
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return json({ ok: false, error: 'Missing authorization' }, 401)

    const { data: userData, error: userError } = await admin.auth.getUser(token)
    if (userError || !userData.user) {
      return json({ ok: false, error: 'Invalid session' }, 401)
    }

    const callerId = userData.user.id
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .maybeSingle()

    if (callerProfile?.role !== 'admin') {
      return json({ ok: false, error: 'Admin access required' }, 403)
    }

    const payload = (await req.json()) as AdminUsersRequest

    async function audit(action: string, targetId: string | null, detail: unknown) {
      await admin.from('admin_audit_log').insert({
        actor_id: callerId,
        action,
        target_id: targetId,
        target_type: 'user',
        detail,
      })
    }

    // --- Actions ---
    if (payload.action === 'list') {
      const [authUsers, profiles, suppliers] = await Promise.all([
        admin.auth.admin.listUsers({ perPage: 1000 }),
        admin.from('profiles').select('*'),
        admin.from('suppliers').select('id, brand_name, slug, is_verified'),
      ])

      const supplierMap = new Map(
        (suppliers.data ?? []).map((s) => [s.id, s]),
      )

      const users = (authUsers.data?.users ?? []).map((u) => {
        const profile = (profiles.data ?? []).find((p) => p.id === u.id)
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          banned: Boolean(
            (u as { banned_until?: string }).banned_until &&
              new Date((u as { banned_until?: string }).banned_until!) > new Date(),
          ),
          profile,
          supplier: supplierMap.get(u.id) ?? null,
        }
      })

      return json({ ok: true, users })
    }

    if (payload.action === 'create') {
      const { email, role, fullName, companyName, brandName, whatsapp } = payload
      if (!email || !role) {
        return json({ ok: false, error: 'email and role are required' }, 400)
      }

      const tempPassword = generateTempPassword()
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          role,
          full_name: fullName ?? null,
          company_name: companyName ?? null,
        },
      })

      if (createError || !created.user) {
        return json({ ok: false, error: createError?.message ?? 'Create failed' }, 400)
      }

      const newId = created.user.id

      // The handle_new_user trigger created the profile; enrich it.
      if (whatsapp) {
        await admin
          .from('profiles')
          .update({
            whatsapp_numbers: [{ label: 'primary', number: whatsapp, primary: true }],
          })
          .eq('id', newId)
      }

      if (role === 'supplier') {
        const brand = brandName || companyName || email.split('@')[0]
        await admin.from('suppliers').upsert({
          id: newId,
          brand_name: brand,
          slug: slugify(brand),
          is_verified: payload.verifySupplier ?? true,
        })
        if (payload.verifySupplier ?? true) {
          await admin.from('profiles').update({ status: 'active' }).eq('id', newId)
        }
      }

      // Welcome notification (in-app)
      await admin.from('notifications').insert({
        user_id: newId,
        type: 'welcome',
        title: 'Welcome to FabricPort',
        body:
          role === 'supplier'
            ? 'Your supplier account is ready. List your fabrics and start receiving inquiries.'
            : role === 'buyer'
              ? 'Your buyer account is ready. Browse the marketplace and send your first inquiry.'
              : 'Your admin account is ready.',
      })

      await audit('user.create', newId, { email, role })

      return json({ ok: true, userId: newId, tempPassword })
    }

    if (payload.action === 'reset_password') {
      if (!payload.userId) return json({ ok: false, error: 'userId required' }, 400)

      const tempPassword = generateTempPassword()
      const { error: resetError } = await admin.auth.admin.updateUserById(payload.userId, {
        password: tempPassword,
      })
      if (resetError) return json({ ok: false, error: resetError.message }, 400)

      await audit('user.reset_password', payload.userId, {})
      return json({ ok: true, tempPassword })
    }

    if (payload.action === 'set_status') {
      if (!payload.userId || !payload.status) {
        return json({ ok: false, error: 'userId and status required' }, 400)
      }

      const { error: statusError } = await admin
        .from('profiles')
        .update({ status: payload.status })
        .eq('id', payload.userId)
      if (statusError) return json({ ok: false, error: statusError.message }, 400)

      // Mirror suspension into auth so sessions cannot be refreshed.
      await admin.auth.admin.updateUserById(payload.userId, {
        ban_duration: payload.status === 'suspended' ? '87600h' : 'none',
      })

      await audit('user.set_status', payload.userId, { status: payload.status })
      return json({ ok: true })
    }

    if (payload.action === 'delete') {
      if (!payload.userId) return json({ ok: false, error: 'userId required' }, 400)
      if (payload.userId === callerId) {
        return json({ ok: false, error: 'You cannot delete your own account' }, 400)
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(payload.userId)
      if (deleteError) return json({ ok: false, error: deleteError.message }, 400)

      await audit('user.delete', payload.userId, {})
      return json({ ok: true })
    }

    return json({ ok: false, error: 'Unknown action' }, 400)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return json({ ok: false, error: message }, 500)
  }
})
