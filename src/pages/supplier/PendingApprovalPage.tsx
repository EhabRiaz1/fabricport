import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useProfile } from '@/hooks/useProfile'

export default function PendingApprovalPage() {
  const { profile, signOut } = useProfile()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md text-center">
        <CardContent className="space-y-6 p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center bg-warning/15">
            <Clock className="h-8 w-8 text-warning" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
              Supplier Portal
            </p>
            <h1 className="mt-2 font-display text-2xl font-semibold text-text-dark">
              Account Pending Approval
            </h1>
            <p className="mt-3 text-sm text-text-dark-secondary">
              Hi{profile?.full_name ? ` ${profile.full_name}` : ''}, your supplier account is
              awaiting admin review. You&apos;ll receive access to the full portal once approved.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild variant="outline">
              <Link to="/">Back to Home</Link>
            </Button>
            <Button variant="ghost" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
