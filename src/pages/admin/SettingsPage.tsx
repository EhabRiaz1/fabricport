import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MessageCircle, RefreshCw, ScrollText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'
import { AdminPageHeader } from './components/AdminPageHeader'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from './components/AdminTable'

interface FxRow {
  rate: number
  fetched_at: string
}

interface WhatsappLogRow {
  id: string
  phone_number: string
  template: string
  status: string | null
  sent_at: string
  user: { full_name: string | null } | null
}

interface AuditRow {
  id: string
  action: string
  target_type: string | null
  detail: Record<string, unknown> | null
  created_at: string
  actor: { full_name: string | null } | null
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function SettingsPage() {
  const [fx, setFx] = useState<FxRow | null>(null)
  const [fxLoading, setFxLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [waLog, setWaLog] = useState<WhatsappLogRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setFxLoading(true)
    const [fxRes, waRes, auditRes] = await Promise.all([
      supabase
        .from('fx_rates')
        .select('rate, fetched_at')
        .eq('base', 'USD')
        .eq('target', 'PKR')
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('whatsapp_log')
        .select('id, phone_number, template, status, sent_at, user:profiles(full_name)')
        .order('sent_at', { ascending: false })
        .limit(8),
      supabase
        .from('admin_audit_log')
        .select('id, action, target_type, detail, created_at, actor:profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    setFx(fxRes.data as FxRow | null)
    setWaLog(
      ((waRes.data ?? []) as unknown[]).map((row) => {
        const r = row as WhatsappLogRow & { user: unknown }
        return { ...r, user: Array.isArray(r.user) ? r.user[0] : r.user } as WhatsappLogRow
      }),
    )
    setAudit(
      ((auditRes.data ?? []) as unknown[]).map((row) => {
        const r = row as AuditRow & { actor: unknown }
        return { ...r, actor: Array.isArray(r.actor) ? r.actor[0] : r.actor } as AuditRow
      }),
    )
    setFxLoading(false)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function refreshFx() {
    setRefreshing(true)
    const { data, error } = await supabase.functions.invoke('refresh-fx-rates', { body: {} })
    if (error) {
      toast.error('Refresh failed', error.message)
    } else {
      toast.success('FX rate refreshed', data?.rate ? `1 USD = ${data.rate} PKR` : undefined)
      await loadAll()
    }
    setRefreshing(false)
  }

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        description="Platform configuration, currency, delivery channels and the audit trail."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* FX rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Exchange Rate</CardTitle>
            <Button variant="outline" size="sm" onClick={refreshFx} disabled={refreshing}>
              <RefreshCw className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Refresh now
            </Button>
          </CardHeader>
          <CardContent>
            {fxLoading ? (
              <Skeleton className="h-16 w-full bg-border-cream" />
            ) : (
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-display text-3xl font-bold tabular-nums tracking-tight text-text-primary">
                    {fx ? Number(fx.rate).toFixed(2) : '—'}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                    PKR per USD — drives marketplace pricing
                  </p>
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                  {fx ? `Updated ${timeAgo(fx.fetched_at)}` : 'Never fetched'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin accounts shortcut */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary">
              Create admins, reset passwords, suspend or remove any account from the user
              directory.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/admin/users?role=admin">
                Manage users
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* WhatsApp delivery log */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <MessageCircle className="h-4 w-4 text-accent" />
            <CardTitle>WhatsApp Delivery Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <Skeleton className="h-24 w-full bg-border-cream" />
              </div>
            ) : waLog.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-text-secondary">
                No WhatsApp messages sent yet. Set the Twilio secrets
                (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM) on the
                send-notification function to enable delivery — in-app and email channels work
                independently.
              </p>
            ) : (
              <AdminTable>
                <AdminTableHead>
                  <AdminTableHeaderCell>Recipient</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Number</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Template</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Sent</AdminTableHeaderCell>
                </AdminTableHead>
                <AdminTableBody>
                  {waLog.map((row) => (
                    <AdminTableRow key={row.id}>
                      <AdminTableCell className="font-medium">
                        {row.user?.full_name ?? '—'}
                      </AdminTableCell>
                      <AdminTableCell className="font-mono text-xs">
                        {row.phone_number}
                      </AdminTableCell>
                      <AdminTableCell className="font-mono text-xs">{row.template}</AdminTableCell>
                      <AdminTableCell>
                        <Badge
                          variant={
                            row.status === 'failed'
                              ? 'danger'
                              : row.status === 'sent' || row.status === 'delivered'
                                ? 'success'
                                : 'default'
                          }
                        >
                          {row.status ?? 'queued'}
                        </Badge>
                      </AdminTableCell>
                      <AdminTableCell className="text-text-secondary">
                        {timeAgo(row.sent_at)}
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}
          </CardContent>
        </Card>

        {/* Audit log */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <ScrollText className="h-4 w-4 text-accent" />
            <CardTitle>Admin Audit Trail</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6">
                <Skeleton className="h-24 w-full bg-border-cream" />
              </div>
            ) : audit.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-text-secondary">
                No privileged actions recorded yet.
              </p>
            ) : (
              <AdminTable>
                <AdminTableHead>
                  <AdminTableHeaderCell>Actor</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Action</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Target</AdminTableHeaderCell>
                  <AdminTableHeaderCell>Detail</AdminTableHeaderCell>
                  <AdminTableHeaderCell>When</AdminTableHeaderCell>
                </AdminTableHead>
                <AdminTableBody>
                  {audit.map((row) => (
                    <AdminTableRow key={row.id}>
                      <AdminTableCell className="font-medium">
                        {row.actor?.full_name ?? 'System'}
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="font-mono text-xs">{row.action}</span>
                      </AdminTableCell>
                      <AdminTableCell className="text-text-secondary">
                        {row.target_type ?? '—'}
                      </AdminTableCell>
                      <AdminTableCell className="max-w-[280px] truncate font-mono text-[11px] text-text-secondary">
                        {row.detail ? JSON.stringify(row.detail) : '—'}
                      </AdminTableCell>
                      <AdminTableCell className="text-text-secondary">
                        {timeAgo(row.created_at)}
                      </AdminTableCell>
                    </AdminTableRow>
                  ))}
                </AdminTableBody>
              </AdminTable>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
