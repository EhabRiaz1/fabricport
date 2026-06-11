import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ScrollText, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendChart, type TrendPoint } from '@/components/shared/TrendChart'
import { subscribePresence, type PresenceEntry } from '@/lib/track'
import { supabase } from '@/lib/supabase'
import type { AdminDashboardStats } from '@/types/app'
import type { AdminAuditLog } from '@/types/database.types'
import { AdminPageHeader } from './components/AdminPageHeader'

function weekLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const AUDIT_LABELS: Record<string, string> = {
  'user.create': 'created an account',
  'user.reset_password': 'reset a password',
  'user.set_status': 'changed account status',
  'user.delete': 'deleted an account',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [presence, setPresence] = useState<PresenceEntry[]>([])
  const [inquiryTrend, setInquiryTrend] = useState<TrendPoint[]>([])
  const [auditLog, setAuditLog] = useState<AdminAuditLog[]>([])
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [productsRes, suppliersRes, buyersRes, inquiriesRes, listingRes, priceRes, trendRes, auditRes] =
      await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase
          .from('suppliers')
          .select('id, profile:profiles!inner(status)', { count: 'exact', head: true })
          .eq('profile.status', 'active'),
        supabase.from('buyers').select('id', { count: 'exact', head: true }),
        supabase
          .from('inquiries')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', monthStart.toISOString()),
        supabase
          .from('listing_requests')
          .select('id', { count: 'exact', head: true })
          .in('status', ['submitted', 'fabric_received', 'scanning']),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('price_approved', false)
          .not('price_min_pkr', 'is', null),
        supabase
          .from('inquiries')
          .select('created_at')
          .gte('created_at', new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000).toISOString())
          .limit(5000),
        supabase
          .from('admin_audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(8),
      ])

    setStats({
      total_products: productsRes.count ?? 0,
      active_suppliers: suppliersRes.count ?? 0,
      registered_buyers: buyersRes.count ?? 0,
      inquiries_this_month: inquiriesRes.count ?? 0,
      live_users: 0,
      pending_listing_requests: listingRes.count ?? 0,
      pending_price_approvals: priceRes.count ?? 0,
    })

    // Weekly inquiry buckets — last 8 weeks
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const trend: TrendPoint[] = []
    for (let i = 7; i >= 0; i--) {
      const start = Date.now() - (i + 1) * weekMs
      const end = Date.now() - i * weekMs
      const count = (trendRes.data ?? []).filter((row) => {
        const t = new Date(row.created_at).getTime()
        return t >= start && t < end
      }).length
      trend.push({ label: weekLabel(new Date(end)), value: count })
    }
    setInquiryTrend(trend)
    setAuditLog((auditRes.data ?? []) as AdminAuditLog[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadDashboard()
    const interval = setInterval(loadDashboard, 60_000)
    return () => clearInterval(interval)
  }, [loadDashboard])

  // Realtime presence stream
  useEffect(() => {
    const unsubscribe = subscribePresence(setPresence)
    return unsubscribe
  }, [])

  const metrics = stats
    ? [
        { label: 'Total Products', value: stats.total_products },
        { label: 'Active Suppliers', value: stats.active_suppliers },
        { label: 'Registered Buyers', value: stats.registered_buyers },
        { label: 'Inquiries (Month)', value: stats.inquiries_this_month },
        { label: 'Live Users', value: presence.length },
      ]
    : []

  const alerts = stats
    ? [
        {
          id: 'listing',
          label: 'Pending listing requests',
          count: stats.pending_listing_requests,
          href: '/admin/listing-pipeline',
        },
        {
          id: 'price',
          label: 'Price approvals needed',
          count: stats.pending_price_approvals,
          href: '/admin/products',
        },
      ].filter((a) => a.count > 0)
    : []

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="Live platform metrics and system alerts."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-24 bg-border-cream" />
                  <Skeleton className="mt-3 h-8 w-16 bg-border-cream" />
                </CardContent>
              </Card>
            ))
          : metrics.map((metric) => (
              <Card key={metric.label}>
                <CardContent className="p-6">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                    {metric.label}
                  </p>
                  <p className="mt-2 font-display text-3xl font-semibold text-text-dark">
                    {metric.value}
                  </p>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />
              Live Presence
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/admin/live">
                Full monitor
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {presence.length === 0 ? (
              <p className="text-sm text-text-dark-secondary">No active users right now.</p>
            ) : (
              <ul className="space-y-2">
                {presence.slice(0, 8).map((entry) => (
                  <li
                    key={entry.session}
                    className="flex items-center justify-between gap-3 border border-border-cream bg-card-hover px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-dark">
                        {entry.company ?? 'Anonymous visitor'}
                      </p>
                      <p className="truncate font-mono text-[10px] text-text-dark-secondary">
                        {entry.path}
                      </p>
                    </div>
                    <Badge variant="status" className="shrink-0">
                      {entry.role ?? 'guest'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inquiry volume — 8 weeks</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-40 w-full bg-border-cream" />
              ) : (
                <TrendChart
                  data={inquiryTrend}
                  height={150}
                  emptyLabel="Inquiries will chart here as they arrive"
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                System Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-24 w-full bg-border-cream" />
              ) : alerts.length === 0 ? (
                <p className="text-sm text-text-dark-secondary">No pending alerts.</p>
              ) : (
                <ul className="space-y-3">
                  {alerts.map((alert) => (
                    <li
                      key={alert.id}
                      className="flex items-center justify-between gap-4 border border-border-cream bg-surface/5 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="warning">{alert.count}</Badge>
                        <span className="text-sm text-text-dark">{alert.label}</span>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={alert.href}>
                          View
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-bronze" />
                Recent Admin Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-20 w-full bg-border-cream" />
              ) : auditLog.length === 0 ? (
                <p className="text-sm text-text-dark-secondary">No admin actions logged yet.</p>
              ) : (
                <ul className="divide-y divide-border-cream">
                  {auditLog.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm text-text-dark">
                        Admin {AUDIT_LABELS[entry.action] ?? entry.action}
                        {entry.detail && typeof entry.detail === 'object' && 'email' in entry.detail
                          ? ` — ${(entry.detail as { email?: string }).email}`
                          : ''}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-text-dark-secondary">
                        {new Date(entry.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
