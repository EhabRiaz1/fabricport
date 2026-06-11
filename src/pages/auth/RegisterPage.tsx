import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ROLE_HOME_PATHS } from '@/types/app'
import type { UserRole } from '@/types/database.types'

const ROLE_COPY: Record<'buyer' | 'supplier', { title: string; blurb: string }> = {
  buyer: { title: 'Buyer', blurb: 'Source fabrics from verified mills' },
  supplier: { title: 'Supplier', blurb: 'List surplus inventory for buyers' },
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [role, setRole] = useState<UserRole>('buyer')

  useEffect(() => {
    const requestedRole = searchParams.get('role')
    if (requestedRole === 'supplier' || requestedRole === 'buyer') {
      setRole(requestedRole)
    }
  }, [searchParams])
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role,
          full_name: fullName,
          company_name: companyName,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.session) {
      navigate(ROLE_HOME_PATHS[role], { replace: true })
      return
    }

    setMessage('Check your email to confirm your account before signing in.')
    setLoading(false)
  }

  return (
    <AuthLayout
      eyebrow="Join the network"
      heading="Create account"
      subheading="Trade surplus fabric with verified partners across Pakistan."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label>I am a</Label>
          <div className="grid grid-cols-2 gap-2">
            {(['buyer', 'supplier'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRole(option)}
                className={cn(
                  'clip-corner-sm border px-4 py-3 text-left transition-colors',
                  role === option
                    ? 'border-accent bg-accent/10'
                    : 'border-border-strong hover:border-accent/50',
                )}
              >
                <span
                  className={cn(
                    'block text-sm font-medium',
                    role === option ? 'text-accent' : 'text-text-primary',
                  )}
                >
                  {ROLE_COPY[option].title}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-text-muted">
                  {ROLE_COPY[option].blurb}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="companyName">Company name</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="h-11"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm text-success">{message}</p>}

        <Button type="submit" className="h-12 w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/auth/login" className="font-medium text-bronze hover:text-accent">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
