import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Clock, Eye, MessageSquare, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { InquiryStatusBadge } from '@/components/shared/InquiryStatusBadge'
import { TrendChart, type TrendPoint } from '@/components/shared/TrendChart'
import { useCounterparties } from '@/hooks/useCounterparties'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import type { SupplierDashboardStats } from '@/types/app'
import type { InquiryStatus } from '@/types/database.types'

/** Minutes as "45m" / "3h" / "2d"; a dash when nothing has been answered yet. */
function durationLabel(minutes: number): string {
  if (!minutes) return '—'
  if (minutes < 60) return `${Math.round(minutes)}m`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / (60 * 24))}d`
}

function weekLabel(start: Date): string {
  return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface RecentInquiry {
  id: string
  status: InquiryStatus
  updated_at: string
  buyer_id: string
}

export default function SupplierDashboardPage() {
  const { profile } = useProfile()
  // Buyer names come from get_counterparty_profiles: a supplier cannot read a
  // buyer's profile row directly, which is why this list used to say "Buyer" (#38).
  const { nameOf } = useCounterparties()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SupplierDashboardStats>({
    total_inquiries: 0,
    open_inquiries: 0,
    response_rate: 0,
    catalogue_views_week: 0,
    catalogue_views_month: 0,
  })
  const [medianReplyMinutes, setMedianReplyMinutes] = useState(0)
  const [recentInquiries, setRecentInquiries] = useState<RecentInquiry[]>([])
  const [inquiryTrend, setInquiryTrend] = useState<TrendPoint[]>([])

  useEffect(() => {
    if (!profile?.id) return

    async function load() {
      setLoading(true)
      const supplierId = profile!.id
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [totalRes, openRes, responseRes, viewsWeekRes, viewsMonthRes, recentRes, trendRes] =
        await Promise.all([
          supabase
            .from('inquiries')
            .select('id', { count: 'exact', head: true })
            .eq('supplier_id', supplierId),
          supabase
            .from('inquiries')
            .select('id', { count: 'exact', head: true })
            .eq('supplier_id', supplierId)
            .eq('status', 'open'),
          // Same RPC as Analytics and admin reports (#22): responded = at least one
          // supplier message, last 90 days, demo accounts excluded.
          supabase.rpc('get_supplier_response_stats', { supplier_uuid: supplierId }),
          supabase
            .from('supplier_page_views')
            .select('id', { count: 'exact', head: true })
            .eq('supplier_id', supplierId)
            .gte('viewed_at', weekAgo),
          supabase
            .from('supplier_page_views')
            .select('id', { count: 'exact', head: true })
            .eq('supplier_id', supplierId)
            .gte('viewed_at', monthAgo),
          supabase
            .from('inquiries')
            .select('id, status, updated_at, buyer_id')
            .eq('supplier_id', supplierId)
            .order('updated_at', { ascending: false })
            .limit(5),
          supabase
            .from('inquiries')
            .select('created_at')
            .eq('supplier_id', supplierId)
            .gte('created_at', new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString())
            .limit(2000),
        ])

      // Weekly inquiry buckets — last 8 weeks
      const weekMs = 7 * 24 * 60 * 60 * 1000
      const trend: TrendPoint[] = []
      for (let i = 7; i >= 0; i--) {
        const start = new Date(Date.now() - (i + 1) * weekMs)
        const end = new Date(Date.now() - i * weekMs)
        const count = (trendRes.data ?? []).filter((row) => {
          const t = new Date(row.created_at).getTime()
          return t >= start.getTime() && t < end.getTime()
        }).length
        trend.push({ label: weekLabel(end), value: count })
      }
      setInquiryTrend(trend)

      const total = totalRes.count ?? 0
      const response = responseRes.data?.[0]

      setStats({
        total_inquiries: total,
        open_inquiries: openRes.count ?? 0,
        response_rate: Math.round(Number(response?.response_rate ?? 0)),
        catalogue_views_week: viewsWeekRes.count ?? 0,
        catalogue_views_month: viewsMonthRes.count ?? 0,
      })
      setMedianReplyMinutes(Number(response?.median_response_minutes ?? 0))
      setRecentInquiries((recentRes.data ?? []) as RecentInquiry[])
      setLoading(false)
    }

    load()
  }, [profile?.id])

  const metrics = [
    { label: 'Total Inquiries', value: stats.total_inquiries, icon: MessageSquare },
    { label: 'Open Inquiries', value: stats.open_inquiries, icon: TrendingUp },
    { label: 'Response Rate (90d)', value: `${stats.response_rate}%`, icon: BarChart3 },
    { label: 'Median Reply', value: durationLabel(medianReplyMinutes), icon: Clock },
    { label: 'Views (7d)', value: stats.catalogue_views_week, icon: Eye },
  ]

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
          Supplier Portal
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Dashboard
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-6">
              {loading ? (
                <Skeleton className="h-10 w-full" />
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
        ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-text-dark">Inquiry volume — 8 weeks</CardTitle>
          <Link
            to="/supplier-portal/analytics"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-bronze transition-colors hover:text-accent"
          >
            Full analytics →
          </Link>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-44 w-full" />
          ) : (
            <TrendChart
              data={inquiryTrend}
              height={170}
              emptyLabel="Inquiries will chart here as they arrive"
            />
          )}
        </CardContent>
      </Card>

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
                    to={`/supplier-portal/inquiries/${inq.id}`}
                    className="flex items-center justify-between py-3 hover:text-accent"
                  >
                    <div>
                      <p className="text-sm font-medium text-text-dark">
                        {nameOf(inq.buyer_id, 'Buyer')}
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
    </div>
  )
}
