import { SupportThread } from '@/components/chat/SupportThread'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/hooks/useProfile'

export default function SupportPage() {
  const { profile } = useProfile()

  if (!profile) {
    return <Skeleton className="h-96 w-full" />
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Support</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Talk to the FabricPort team
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Questions about listings, samples, payments, or anything else — we are here.
        </p>
      </div>

      <div className="overflow-hidden border border-border-cream">
        <SupportThread threadUserId={profile.id} currentUserId={profile.id} />
      </div>
    </div>
  )
}
