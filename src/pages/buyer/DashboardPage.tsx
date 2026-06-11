import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Package, ShoppingCart } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { InquiryStatusBadge } from '@/components/shared/InquiryStatusBadge'
import { useProfile } from '@/hooks/useProfile'
import { countUnreadMessagesForBuyer } from '@/lib/inquiries'
import { supabase } from '@/lib/supabase'
import { getProductImageUrl } from '@/lib/utils'
import type { InquiryWithRelations, RecentViewWithProduct } from '@/types/app'

const PRODUCT_SELECT = `
  *,
  supplier:suppliers(*),
  category:fabric_categories(*)
`

export default function BuyerDashboardPage() {
  const { profile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [activeInquiries, setActiveInquiries] = useState(0)
  const [cartCount, setCartCount] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [recentInquiries, setRecentInquiries] = useState<InquiryWithRelations[]>([])
  const [recentViews, setRecentViews] = useState<RecentViewWithProduct[]>([])

  useEffect(() => {
    if (!profile?.id) return

    async function load() {
      setLoading(true)
      const buyerId = profile!.id

      const [inquiriesRes, cartRes, recentInqRes, viewsRes] = await Promise.all([
        supabase
          .from('inquiries')
          .select('id', { count: 'exact', head: true })
          .eq('buyer_id', buyerId)
          .in('status', ['open', 'responded', 'negotiating']),
        supabase
          .from('cart_items')
          .select('id', { count: 'exact', head: true })
          .eq('buyer_id', buyerId),
        supabase
          .from('inquiries')
          .select('*, supplier:suppliers(*)')
          .eq('buyer_id', buyerId)
          .order('updated_at', { ascending: false })
          .limit(5),
        supabase
          .from('recent_views')
          .select(`product_id, viewed_at, product:products(${PRODUCT_SELECT})`)
          .eq('user_id', buyerId)
          .order('viewed_at', { ascending: false })
          .limit(6),
      ])

      const unreadCount = await countUnreadMessagesForBuyer(buyerId)

      setActiveInquiries(inquiriesRes.count ?? 0)
      setCartCount(cartRes.count ?? 0)
      setUnreadMessages(unreadCount)
      setRecentInquiries((recentInqRes.data ?? []) as InquiryWithRelations[])
      setRecentViews(
        (viewsRes.data ?? [])
          .filter((v) => v.product)
          .map((v) => ({
            product_id: v.product_id,
            viewed_at: v.viewed_at,
            product: v.product as RecentViewWithProduct['product'],
          })),
      )
      setLoading(false)
    }

    load()
  }, [profile?.id])

  const metrics = [
    { label: 'Active Inquiries', value: activeInquiries, icon: MessageSquare, href: '/buyer/inquiries' },
    { label: 'Cart Items', value: cartCount, icon: ShoppingCart, href: '/buyer/cart' },
    { label: 'Unread Messages', value: unreadMessages, icon: Package, href: '/buyer/inquiries' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Buyer Portal</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} to={href}>
            <Card className="transition-transform hover:scale-[1.01]">
              <CardContent className="flex items-center gap-4 p-6">
                {loading ? (
                  <Skeleton className="h-10 w-10" />
                ) : (
                  <>
                    <div className="flex h-10 w-10 items-center justify-center bg-accent/10">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                        {label}
                      </p>
                      <p className="font-display text-2xl font-semibold text-text-dark">{value}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-text-dark">Recent Inquiries</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : recentInquiries.length === 0 ? (
              <p className="text-sm text-text-dark-secondary">No inquiries yet.</p>
            ) : (
              <ul className="divide-y divide-border-cream">
                {recentInquiries.map((inq) => (
                  <li key={inq.id}>
                    <Link
                      to={`/buyer/inquiries/${inq.id}`}
                      className="flex items-center justify-between py-3 hover:text-accent"
                    >
                      <div>
                        <p className="text-sm font-medium text-text-dark">
                          {inq.supplier?.brand_name ?? 'Supplier'}
                        </p>
                        <p className="font-mono text-[10px] text-text-dark-secondary">
                          {new Date(inq.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <InquiryStatusBadge status={inq.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-text-dark">Recently Viewed Fabrics</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="aspect-square w-full" />
                ))}
              </div>
            ) : recentViews.length === 0 ? (
              <p className="text-sm text-text-dark-secondary">
                Browse the{' '}
                <Link to="/marketplace" className="text-accent hover:underline">
                  marketplace
                </Link>{' '}
                to see fabrics here.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {recentViews.map((view) => (
                  <Link
                    key={view.product_id}
                    to={`/fabric/${view.product.slug}`}
                    className="group overflow-hidden border border-border-cream bg-card-hover"
                  >
                    {view.product.images[0] ? (
                      <img
                        src={getProductImageUrl(view.product.images[0], { variant: 'card' })}
                        alt={view.product.title}
                        className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-elevated text-text-dark-secondary">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                    <p className="truncate px-2 py-1.5 text-xs text-text-dark">
                      {view.product.title}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
