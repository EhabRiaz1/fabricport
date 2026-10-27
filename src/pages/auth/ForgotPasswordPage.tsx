import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <AuthLayout
      eyebrow="Account recovery"
      heading="Forgot your password?"
      subheading="Enter the email on your account and we'll send a link to set a new one."
    >
      <title>Reset password · FabricPort</title>
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-text-secondary">
            If an account exists for <span className="font-medium text-text-primary">{email}</span>,
            a reset link is on its way. It expires in one hour. Check your spam folder if it
            doesn't arrive within a few minutes.
          </p>
          <Button
            variant="outline"
            className="h-11 w-full"
            onClick={() => {
              setSent(false)
              setEmail('')
            }}
          >
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" className="h-12 w-full" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-text-secondary">
        Remembered it?{' '}
        <Link to="/auth/login" className="font-medium text-bronze hover:text-accent">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
