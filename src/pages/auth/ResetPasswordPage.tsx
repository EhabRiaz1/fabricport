import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_HOME_PATHS } from '@/types/app'

/**
 * Landing page for the password-recovery email link. supabase-js exchanges the
 * code in the URL for a recovery session on load and AuthContext records the
 * PASSWORD_RECOVERY event; this page then lets the user set a new password.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { session, isLoading, isPasswordRecovery, clearPasswordRecovery, role } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Give the code exchange a moment before declaring the link dead.
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 2500)
    return () => clearTimeout(timer)
  }, [])

  const linkError =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('error=') || window.location.search.includes('error='))

  const hasRecoverySession = Boolean(session) && (isPasswordRecovery || !isLoading)
  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = !saving && password.length >= 8 && password === confirm

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    clearPasswordRecovery()
    setDone(true)
    setSaving(false)
  }

  function goToPortal() {
    navigate(role ? ROLE_HOME_PATHS[role] : '/', { replace: true })
  }

  if (done) {
    return (
      <AuthLayout
        eyebrow="Account recovery"
        heading="Password updated"
        subheading="You're signed in with your new password."
      >
        <Button className="h-12 w-full" onClick={goToPortal}>
          Continue
        </Button>
      </AuthLayout>
    )
  }

  if (linkError || (settled && !session && !isLoading)) {
    return (
      <AuthLayout
        eyebrow="Account recovery"
        heading="This link has expired"
        subheading="Reset links work once and expire after an hour."
      >
        <Link
          to="/auth/forgot-password"
          className="block w-full bg-ink py-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[#E8E4DC] transition-colors hover:bg-ink-soft"
        >
          Request a new link
        </Link>
      </AuthLayout>
    )
  }

  if (!hasRecoverySession) {
    return (
      <AuthLayout eyebrow="Account recovery" heading="Checking your link…">
        <p className="text-sm text-text-secondary">One moment.</p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      heading="Set a new password"
      subheading="Use at least 8 characters."
    >
      <title>Set new password · FabricPort</title>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="h-11"
          />
        </div>

        {mismatch && <p className="text-sm text-danger">The two passwords do not match.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" className="h-12 w-full" disabled={!canSubmit}>
          {saving ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
