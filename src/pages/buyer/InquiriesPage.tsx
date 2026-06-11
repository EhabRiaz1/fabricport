import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { InquiryStatusBadge } from '@/components/shared/InquiryStatusBadge'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import type { InquiryWithRelations } from '@/types/app'

export default function BuyerInquiriesPage() {
  const { profile } = useProfile()
  const [inquiries, setInquiries] = useState<InquiryWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('inquiries')
        .select('*, supplier:suppliers(*), items:inquiry_items(count)')
        .eq('buyer_id', profile!.id)
        .order('updated_at', { ascending: false })

      setInquiries((data ?? []) as unknown as InquiryWithRelations[])
      setLoading(false)
    }

    load()
  }, [profile?.id])

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Inquiries</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Your Inquiries
        </h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-text-dark-secondary">
            No inquiries yet. Add fabrics to your cart to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => (
            <Link key={inq.id} to={`/buyer/inquiries/${inq.id}`}>
              <Card className="transition-transform hover:scale-[1.005]">
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="font-medium text-text-dark">
                      {inq.supplier?.brand_name ?? 'Supplier'}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-text-dark-secondary">
                      Updated {new Date(inq.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <InquiryStatusBadge status={inq.status} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
