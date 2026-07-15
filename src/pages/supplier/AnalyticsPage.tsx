import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Building2, Clock, Eye, MessageSquare, Radio } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendChart, type TrendPoint } from '@/components/shared/TrendChart'
import { useProfile } from '@/hooks/useProfile'
import { subscribePresence, type PresenceEntry } from '@/lib/track'
import { supabase } from '@/lib/supabase'
import { getProductImageUrl } from '@/lib/utils'

interface VisitorStat {
  viewer_id: string
  company_name: string | null
  full_name: string | null
  viewer_role: string | null
  visit_count: number
  product_views: number
  last_visit: string
}

interface TopProduct {
  product_id: string
  views: number
  title: string
  slug: string
  image: string | null
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function durationLabel(minutes: number): string {
  if (!minutes) return '—'
  if (minutes < 60) return `${Math.round(minutes)}m`
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / (60 * 24))}d`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function SupplierAnalyticsPage() {
  const { profile } = useProfile()
  const [loading, setLoading] = useState(true)
  const [dailyViews, setDailyViews] = useState<TrendPoint[]>([])
  const [totals, setTotals] = useState({ month: 0, week: 0, uniqueCompanies: 0 })
  const [visitors, setVisitors] = useState<VisitorStat[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [responseStats, setResponseStats] = useState({ rate: 0, medianMinutes: 0 })
  const [liveVisitors, setLiveVisitors] = useState<PresenceEntry[]>([])

  // Live visitors on this supplier's catalogue/product pages.
  useEffect(() => {
    if (!profile?.id) return
    const supplierId = profile.id
    const unsubscribe = subscribePresence((entries) => {
      setLiveVisitors(entries.filter((entry) => entry.supplierId === supplierId))
    })
    return unsubscribe
  }, [profile?.id])

  useEffect(() => {
    if (!profile?.id) return
    const supplierId = profile.id

    async function load() {
      setLoading(true)
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

      const [viewsRes, visitorsRes, responseRes] = await Promise.all([
        supabase
          .from('supplier_page_views')
          .select('viewed_at, product_id')
          .eq('supplier_id', supplierId)
          .gte('viewed_at', monthAgo.toISOString())
          .order('viewed_at', { ascending: true })
          .limit(5000),
        supabase.rpc('get_supplier_visitor_stats', { supplier_uuid: supplierId }),
        supabase.rpc('get_supplier_response_stats', { supplier_uuid: supplierId }),
      ])

      const views = viewsRes.data ?? []

      const response = responseRes.data?.[0]
      setResponseStats({
        rate: response?.response_rate ?? 0,
        medianMinutes: response?.median_response_minutes ?? 0,
      })

      // Daily buckets — last 30 days
      const buckets = new Map<string, number>()
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        buckets.set(d.toDateString(), 0)
      }
      let weekCount = 0
      const productCounts = new Map<string, number>()
      for (const view of views) {
        const key = new Date(view.viewed_at).toDateString()
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
        if (new Date(view.viewed_at).getTime() >= weekAgo) weekCount++
        if (view.product_id) {
          productCounts.set(view.product_id, (productCounts.get(view.product_id) ?? 0) + 1)
        }
      }

      setDailyViews(
        Array.from(buckets.entries()).map(([key, value]) => ({
          label: dayLabel(new Date(key)),
          value,
        })),
      )

      const visitorStats = (visitorsRes.data ?? []) as VisitorStat[]
      setVisitors(visitorStats)
      setTotals({
        month: views.length,
        week: weekCount,
        uniqueCompanies: visitorStats.length,
      })

      // Resolve top products
      const topIds = Array.from(productCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id)

      if (topIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, title, slug, images')
          .in('id', topIds)

        setTopProducts(
          topIds
            .map((id) => {
              const p = (products ?? []).find((row) => row.id === id)
              if (!p) return null
              return {
                product_id: id,
                views: productCounts.get(id) ?? 0,
                title: p.title,
                slug: p.slug,
                image: (p.images as string[])?.[0]
                  ? getProductImageUrl((p.images as string[])[0], { variant: 'card' })
                  : null,
              }
            })
            .filter((p): p is TopProduct => p !== null),
        )
      } else {
        setTopProducts([])
      }

      setLoading(false)
    }

    load()
  }, [profile?.id])

  const liveCount = liveVisitors.length
  const liveCompanies = useMemo(
    () =>
      Array.from(
        new Set(liveVisitors.map((v) => v.company ?? 'Anonymous visitor')),
      ),
    [liveVisitors],
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
            Analytics
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Catalogue insights
          </h1>
        </div>
        <div className="flex items-center gap-2 border border-border bg-surface px-4 py-2">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={
                liveCount > 0
                  ? 'absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60'
                  : 'hidden'
              }
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${liveCount > 0 ? 'bg-success' : 'bg-text-muted/40'}`}
            />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">
            {liveCount} live now
          </span>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Live visitors', value: liveCount, icon: Radio },
          { label: 'Views (7d)', value: totals.week, icon: Activity },
          { label: 'Views (30d)', value: totals.month, icon: Eye },
          { label: 'Companies (30d)', value: totals.uniqueCompanies, icon: Building2 },
          { label: 'Response rate', value: `${responseStats.rate}%`, icon: MessageSquare },
          { label: 'Median reply', value: durationLabel(responseStats.medianMinutes), icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-6">
              {loading && label !== 'Live visitors' ? (
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
                    <p className="font-display text-2xl font-semibold text-text-dark">
                      {value}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live + history */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-text-dark">Daily catalogue views — 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <TrendChart data={dailyViews} height={180} emptyLabel="No views yet — share your catalogue link" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-text-dark">
              Watching right now
              {liveCount > 0 && (
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-success" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {liveCount === 0 ? (
              <p className="py-6 text-center text-sm text-text-dark-secondary">
                No one is viewing your catalogue right now.
              </p>
            ) : (
              <ul className="space-y-3">
                {liveCompanies.map((company) => (
                  <li
                    key={company}
                    className="flex items-center gap-3 border border-border-cream bg-card-hover px-4 py-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center bg-success/10 font-display text-sm font-semibold text-success">
                      {company.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-dark">{company}</p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-success">
                        Live on your catalogue
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Visiting companies */}
        <Card>
          <CardHeader>
            <CardTitle className="text-text-dark">Visiting companies — 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : visitors.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-dark-secondary">
                Signed-in visitors will appear here with their company.
              </p>
            ) : (
              <ul className="divide-y divide-border-cream">
                {visitors.map((visitor) => (
                  <li
                    key={visitor.viewer_id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-dark">
                        {visitor.company_name ?? visitor.full_name ?? 'Member'}
                      </p>
                      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-text-dark-secondary">
                        {visitor.visit_count} visit{visitor.visit_count === 1 ? '' : 's'} ·{' '}
                        {visitor.product_views} fabric views
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-text-dark-secondary">
                      {relativeTime(visitor.last_visit)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top fabrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-text-dark">Most viewed fabrics — 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-dark-secondary">
                Product view counts will appear here.
              </p>
            ) : (
              <ul className="space-y-3">
                {topProducts.map((product, index) => (
                  <li key={product.product_id}>
                    <Link
                      to={`/fabric/${product.slug}`}
                      className="group flex items-center gap-4 border border-border-cream bg-card-hover px-3 py-2.5 transition-colors hover:border-accent/40"
                    >
                      <span className="font-mono text-[10px] text-text-dark-secondary">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="h-10 w-10 shrink-0 overflow-hidden bg-elevated">
                        {product.image && (
                          <img
                            src={product.image}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-dark group-hover:text-accent">
                        {product.title}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-text-dark-secondary">
                        {product.views} views
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
