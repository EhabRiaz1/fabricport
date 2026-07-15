import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { useAuth } from '@/contexts/AuthContext'

export default function PendingPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout
      eyebrow="Almost there"
      heading="Account pending"
      subheading="Your account is awaiting review. We'll email you as soon as it's approved."
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-text-secondary">
          Access to your portal opens once our team activates your account. This usually
          takes one business day.
        </p>
        <Button variant="outline" className="h-11 w-full" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </AuthLayout>
  )
}
