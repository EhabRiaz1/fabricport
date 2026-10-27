import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { cn } from '@/lib/utils'
import { normalizePhone, phoneError } from '@/lib/phone'
import { supabase } from '@/lib/supabase'
import { ROLE_HOME_PATHS, isPortalZone } from '@/types/app'
import type { UserRole } from '@/types/database.types'

const ROLE_COPY: Record<'buyer' | 'supplier', { title: string; blurb: string }> = {
  buyer: { title: 'Buyer', blurb: 'Source fabrics from verified mills' },
  supplier: { title: 'Supplier', blurb: 'List surplus inventory for buyers' },
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const from = (location.state as { from?: string } | null)?.from
  const [role, setRole] = useState<UserRole>('buyer')

  useEffect(() => {
    const requestedRole = searchParams.get('role')
    if (requestedRole === 'supplier' || requestedRole === 'buyer') {
      setRole(requestedRole)
    }
  }, [searchParams])
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const phoneProblem = phoneError(phone, 'Phone number')
  const whatsappProblem = phoneError(whatsapp, 'WhatsApp number')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!agreed) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }
    if (phoneProblem || whatsappProblem) {
      setError(phoneProblem ?? whatsappProblem)
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          role,
          full_name: fullName.trim(),
          company_name: companyName.trim(),
          phone: normalizePhone(phone),
          // The field promises "same as phone if blank".
          whatsapp: normalizePhone(whatsapp) || normalizePhone(phone),
          terms_accepted_at: new Date().toISOString(),
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.session) {
      // Honour a return URL only when it is a public path or this role's own zone.
      const fromZone = from ? isPortalZone(from) : null
      const target =
        from && !from.startsWith('/auth') && (fromZone === null || fromZone === role)
          ? from
          : ROLE_HOME_PATHS[role]
      navigate(target, { replace: true })
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
            required
            autoComplete="organization"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="h-11"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="+92 300 0000000"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              aria-invalid={Boolean(phoneProblem)}
              className="h-11"
            />
            {phoneProblem && <p className="text-xs text-danger">{phoneProblem}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              type="tel"
              autoComplete="tel"
              placeholder="Same as phone if blank"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              aria-invalid={Boolean(whatsappProblem)}
              className="h-11"
            />
            {whatsappProblem && <p className="text-xs text-danger">{whatsappProblem}</p>}
          </div>
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

        <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-text-secondary">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
            required
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="font-medium text-bronze hover:text-accent">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" target="_blank" className="font-medium text-bronze hover:text-accent">
              Privacy Policy
            </Link>
            .
          </span>
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm text-success">{message}</p>}

        <Button type="submit" className="h-12 w-full" disabled={loading || !agreed}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link
          to="/auth/login"
          state={from ? { from } : undefined}
          className="font-medium text-bronze hover:text-accent"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
