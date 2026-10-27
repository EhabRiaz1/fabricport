import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'

export interface ChangePasswordCardProps {
  /** The signed-in account email; used to re-authenticate before the change. */
  email: string
}

/**
 * Change-password card for the buyer and supplier settings pages.
 *
 * Re-authenticates with the current password first so a stolen open session
 * cannot be used to lock the real owner out, then calls `updateUser`.
 */
export function ChangePasswordCard({ email }: ChangePasswordCardProps) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && next !== confirm
  const tooShort = next.length > 0 && next.length < 8
  const canSubmit =
    !saving && current.length > 0 && next.length >= 8 && next === confirm && next !== current

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    })
    if (reauthError) {
      setError('Current password is incorrect.')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    if (updateError) {
      setError(updateError.message)
      toast.error('Password not changed', updateError.message)
      setSaving(false)
      return
    }

    toast.success('Password changed')
    setCurrent('')
    setNext('')
    setConfirm('')
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-text-dark">Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-text-dark">
              Current password
            </Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="border-border-cream bg-card-hover text-text-dark"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-text-dark">
                New password
              </Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className="border-border-cream bg-card-hover text-text-dark"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-text-dark">
                Confirm new password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="border-border-cream bg-card-hover text-text-dark"
              />
            </div>
          </div>
          {tooShort && (
            <p className="text-xs text-danger">Use at least 8 characters.</p>
          )}
          {mismatch && !tooShort && (
            <p className="text-xs text-danger">The two passwords do not match.</p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={!canSubmit}>
            {saving ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default ChangePasswordCard
