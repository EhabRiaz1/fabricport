import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ROLE_HOME_PATHS } from '@/types/app'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, isAuthenticated, profileError } = useAuth()
  const from = (location.state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect once AuthContext resolves the profile (after sign-in or for an
  // already-authenticated visitor). Never query the profile here: doing so
  // mid-sign-in deadlocks supabase-js.
  useEffect(() => {
    if (!isAuthenticated || !role) return
    const target = from && !from.startsWith('/auth') ? from : ROLE_HOME_PATHS[role]
    navigate(target, { replace: true })
  }, [isAuthenticated, role, from, navigate])

  useEffect(() => {
    if (profileError && loading) {
      setError(profileError)
      setLoading(false)
    }
  }, [profileError, loading])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }
    // Keep the button in its loading state; the redirect effect fires as soon
    // as the profile resolves.
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      heading="Sign in"
      subheading="Access your buyer, supplier, or admin portal."
    >
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

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" className="h-12 w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-secondary">
        New to FabricPort?{' '}
        <Link to="/auth/register" className="font-medium text-bronze hover:text-accent">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
