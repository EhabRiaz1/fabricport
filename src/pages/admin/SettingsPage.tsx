import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  MessageCircle,
  Plus,
  RefreshCw,
  ScrollText,
  X,
} from 'lucide-react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { getFxRate } from '@/lib/fx'
import {
  DEFAULT_INVOICE_DEFAULTS,
  DEFAULT_PAYMENT_TERMS_OPTIONS,
  getSetting,
  setSetting,
  type FxOverride,
  type InvoiceDefaults,
} from '@/lib/settings'
import { useAuth } from '@/contexts/AuthContext'
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

/** "key: value · key: value" for the audit trail; nested values are flattened. */
function formatDetail(detail: Record<string, unknown> | null): string {
  if (!detail || typeof detail !== 'object') return '—'
  const parts: string[] = []
  const walk = (prefix: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return
    if (Array.isArray(value)) {
      if (value.length === 0) return
      parts.push(`${prefix}: ${value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')}`)
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(prefix ? `${prefix}.${k}` : k, v)
      }
    } else {
      parts.push(`${prefix.replace(/_/g, ' ')}: ${String(value)}`)
    }
  }
  walk('', detail)
  return parts.length ? parts.join(' · ') : '—'
}

/** The function returns {ok:false, error} on failure; surface that text, not "non-2xx". */
async function functionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (body?.error) return String(body.error)
    } catch {
      /* body was not JSON; fall through */
    }
  }
  return error instanceof Error ? error.message : 'Unknown error'
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
  const [fxError, setFxError] = useState<string | null>(null)
  const [fxStale, setFxStale] = useState(false)
  const { user } = useAuth()

  // Manual FX override (app_settings.fx_override)
  const [override, setOverride] = useState<FxOverride | null>(null)
  const [overrideRate, setOverrideRate] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [overrideErr, setOverrideErr] = useState<string | null>(null)
  const [savingOverride, setSavingOverride] = useState(false)

  // Invoice defaults (app_settings.invoice_defaults / invoice_payment_terms_options)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [invDefaults, setInvDefaults] = useState<InvoiceDefaults>(DEFAULT_INVOICE_DEFAULTS)
  const [taxInput, setTaxInput] = useState(String(DEFAULT_INVOICE_DEFAULTS.tax_rate_percent))
  const [freightInput, setFreightInput] = useState(String(DEFAULT_INVOICE_DEFAULTS.freight_pkr))
  const [termsOptions, setTermsOptions] = useState<string[]>(DEFAULT_PAYMENT_TERMS_OPTIONS)
  const [newTerm, setNewTerm] = useState('')
  const [invErrors, setInvErrors] = useState<{ tax?: string; freight?: string; terms?: string }>({})
  const [savingInvoice, setSavingInvoice] = useState(false)

  const loadSettings = useCallback(async () => {
    try {
      const [ov, defs, opts] = await Promise.all([
        getSetting('fx_override'),
        getSetting('invoice_defaults'),
        getSetting('invoice_payment_terms_options'),
      ])
      setOverride(ov && Number(ov.rate) > 0 ? ov : null)
      const d = { ...DEFAULT_INVOICE_DEFAULTS, ...(defs ?? {}) }
      setInvDefaults(d)
      setTaxInput(String(d.tax_rate_percent))
      setFreightInput(String(d.freight_pkr))
      setTermsOptions(Array.isArray(opts) && opts.length ? opts : DEFAULT_PAYMENT_TERMS_OPTIONS)
      setSettingsError(null)
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : 'Could not load platform settings')
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setFxLoading(true)
    void loadSettings()
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
    setFxStale(
      Boolean(fxRes.data) &&
        Date.now() - new Date((fxRes.data as FxRow).fetched_at).getTime() > 36 * 3600_000,
    )
    if (fxRes.error) setFxError(`Could not read fx_rates: ${fxRes.error.message}`)
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
  }, [loadSettings])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function refreshFx() {
    setRefreshing(true)
    const { data, error } = await supabase.functions.invoke('refresh-fx-rates', { body: {} })
    if (error || data?.ok === false) {
      const message = error ? await functionErrorMessage(error) : String(data?.error ?? 'Unknown error')
      setFxError(`Last refresh failed: ${message}. The stored rate was left unchanged.`)
      toast.error('Refresh failed', message)
    } else {
      setFxError(null)
      toast.success('FX rate refreshed', data?.rate ? `1 USD = ${data.rate} PKR` : undefined)
      await loadAll()
      void getFxRate(true).catch(() => undefined)
    }
    setRefreshing(false)
  }

  async function saveOverride() {
    const rate = Number(overrideRate)
    if (!overrideRate.trim() || !Number.isFinite(rate) || rate <= 0) {
      setOverrideErr('Enter a rate greater than 0 (PKR per 1 USD).')
      return
    }
    if (rate < 50 || rate > 2000) {
      setOverrideErr('That looks wrong for PKR per USD. Enter a value between 50 and 2000.')
      return
    }
    setOverrideErr(null)
    setSavingOverride(true)
    const value: FxOverride = {
      rate: Math.round(rate * 10000) / 10000,
      note: overrideNote.trim() || null,
      set_by: user?.profile?.full_name || user?.email || user?.id || null,
      set_at: new Date().toISOString(),
    }
    try {
      await setSetting('fx_override', value)
      setOverride(value)
      setOverrideRate('')
      setOverrideNote('')
      void getFxRate(true).catch(() => undefined)
      toast.success('Override saved', `Marketplace now uses 1 USD = ${value.rate} PKR`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setOverrideErr(msg)
      toast.error('Could not save override', msg)
    }
    setSavingOverride(false)
  }

  async function clearOverride() {
    setSavingOverride(true)
    try {
      await setSetting('fx_override', null)
      setOverride(null)
      void getFxRate(true).catch(() => undefined)
      toast.success('Override cleared', 'Marketplace is back on the fetched rate')
    } catch (e) {
      toast.error('Could not clear override', e instanceof Error ? e.message : undefined)
    }
    setSavingOverride(false)
  }

  function addTerm() {
    const t = newTerm.trim()
    if (!t) return
    if (termsOptions.some((o) => o.toLowerCase() === t.toLowerCase())) {
      setInvErrors((e) => ({ ...e, terms: `"${t}" is already in the list.` }))
      return
    }
    setTermsOptions((o) => [...o, t])
    setNewTerm('')
    setInvErrors((e) => ({ ...e, terms: undefined }))
  }

  function removeTerm(term: string) {
    setTermsOptions((o) => o.filter((x) => x !== term))
  }

  async function saveInvoiceDefaults() {
    const tax = Number(taxInput)
    const freight = Number(freightInput)
    const errs: typeof invErrors = {}
    if (taxInput.trim() === '' || !Number.isFinite(tax) || tax < 0 || tax > 100) {
      errs.tax = 'Tax rate must be between 0 and 100.'
    }
    if (freightInput.trim() === '' || !Number.isFinite(freight) || freight < 0) {
      errs.freight = 'Freight must be 0 or more.'
    }
    if (termsOptions.length === 0) errs.terms = 'Keep at least one payment term.'
    else if (!termsOptions.includes(invDefaults.payment_terms)) {
      errs.terms = 'The default payment term must be one of the options.'
    }
    setInvErrors(errs)
    if (Object.keys(errs).length) return

    setSavingInvoice(true)
    const next: InvoiceDefaults = { ...invDefaults, tax_rate_percent: tax, freight_pkr: freight }
    try {
      await setSetting('invoice_defaults', next)
      await setSetting('invoice_payment_terms_options', termsOptions)
      setInvDefaults(next)
      toast.success('Invoice defaults saved', 'New invoices will start with these values')
    } catch (e) {
      toast.error('Could not save invoice defaults', e instanceof Error ? e.message : undefined)
    }
    setSavingInvoice(false)
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
          <CardContent className="space-y-4">
            {override && (
              <div className="flex items-start gap-3 border border-warning/40 bg-warning/10 p-3 text-sm text-text-primary">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    Manual override active: 1 USD = {Number(override.rate).toFixed(2)} PKR
                  </p>
                  <p className="mt-0.5 text-xs">
                    Set {timeAgo(override.set_at)}
                    {override.set_by ? ` by ${override.set_by}` : ''}
                    {override.note ? ` · ${override.note}` : ''}. The daily refresh keeps
                    running but the marketplace ignores it until you clear this.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearOverride}
                  disabled={savingOverride}
                >
                  Clear
                </Button>
              </div>
            )}
            {fxLoading ? (
              <Skeleton className="h-16 w-full bg-border-cream" />
            ) : (
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-display text-3xl font-bold tabular-nums tracking-tight text-text-primary">
                    {override
                      ? Number(override.rate).toFixed(2)
                      : fx
                        ? Number(fx.rate).toFixed(2)
                        : '—'}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                    PKR per USD — drives marketplace pricing
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Source:{' '}
                    {override
                      ? `manual override (fetched rate ${fx ? Number(fx.rate).toFixed(2) : '—'})`
                      : 'fetched rate (open.er-api.com, refreshed daily 03:00 UTC)'}
                  </p>
                </div>
                <p className="text-right font-mono text-[10px] uppercase tracking-widest text-text-secondary">
                  {fx
                    ? `Last refresh ${timeAgo(fx.fetched_at)}`
                    : 'Never fetched'}
                  {fx && (
                    <span className="block normal-case tracking-normal">
                      {new Date(fx.fetched_at).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            )}
            {!fxLoading && fxStale && (
              <p role="alert" className="border border-warning/40 bg-warning/10 p-2 text-xs text-text-primary">
                The fetched rate is more than a day old, so the daily 03:00 UTC refresh is
                probably failing. Check the refresh-fx-rates function logs and the cron
                vault secrets, or press Refresh now.
              </p>
            )}
            {fxError && (
              <p role="alert" className="border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
                {fxError}
              </p>
            )}
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-text-primary">Manual override</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Pins the rate used for every USD price until cleared.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
                <div>
                  <Label htmlFor="fx-override-rate">PKR per USD</Label>
                  <Input
                    id="fx-override-rate"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={overrideRate}
                    onChange={(e) => setOverrideRate(e.target.value)}
                    placeholder={fx ? Number(fx.rate).toFixed(2) : '280.00'}
                    aria-invalid={overrideErr ? true : undefined}
                  />
                </div>
                <div>
                  <Label htmlFor="fx-override-note">Note (optional)</Label>
                  <Input
                    id="fx-override-note"
                    value={overrideNote}
                    onChange={(e) => setOverrideNote(e.target.value)}
                    placeholder="e.g. SBP interbank rate"
                    maxLength={140}
                  />
                </div>
                <Button size="sm" onClick={saveOverride} disabled={savingOverride}>
                  {override ? 'Replace override' : 'Set override'}
                </Button>
              </div>
              {overrideErr && <p className="mt-2 text-xs text-danger">{overrideErr}</p>}
            </div>
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

        {/* Invoice defaults */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <FileText className="h-4 w-4 text-accent" />
            <CardTitle>Invoice Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settingsError && (
              <p role="alert" className="border border-danger/30 bg-danger/5 p-2 text-xs text-danger">
                Could not load settings: {settingsError}
              </p>
            )}
            <p className="text-sm text-text-secondary">
              Starting values for new supplier invoices. Suppliers can change them per invoice.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="inv-tax">Tax rate (%)</Label>
                <Input
                  id="inv-tax"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={taxInput}
                  onChange={(e) => setTaxInput(e.target.value)}
                  aria-invalid={invErrors.tax ? true : undefined}
                />
                {invErrors.tax && <p className="mt-1 text-xs text-danger">{invErrors.tax}</p>}
              </div>
              <div>
                <Label htmlFor="inv-tax-mode">Tax applied</Label>
                <Select
                  value={invDefaults.tax_mode}
                  onValueChange={(v) =>
                    setInvDefaults((d) => ({ ...d, tax_mode: v as InvoiceDefaults['tax_mode'] }))
                  }
                >
                  <SelectTrigger id="inv-tax-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">On the invoice total</SelectItem>
                    <SelectItem value="per_line">Per line</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="inv-freight">Freight (PKR)</Label>
                <Input
                  id="inv-freight"
                  type="number"
                  min={0}
                  step="1"
                  value={freightInput}
                  onChange={(e) => setFreightInput(e.target.value)}
                  aria-invalid={invErrors.freight ? true : undefined}
                />
                {invErrors.freight && (
                  <p className="mt-1 text-xs text-danger">{invErrors.freight}</p>
                )}
              </div>
              <div>
                <Label htmlFor="inv-terms">Default payment terms</Label>
                <Select
                  value={termsOptions.includes(invDefaults.payment_terms) ? invDefaults.payment_terms : undefined}
                  onValueChange={(v) => setInvDefaults((d) => ({ ...d, payment_terms: v }))}
                >
                  <SelectTrigger id="inv-terms">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {termsOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Payment terms options</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {termsOptions.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 border border-border bg-surface px-2 py-1 text-xs"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => removeTerm(t)}
                      className="text-text-secondary hover:text-text-primary"
                      aria-label={`Remove ${t}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex max-w-sm gap-2">
                <Input
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTerm()
                    }
                  }}
                  placeholder="Add an option, e.g. Net 90"
                  maxLength={60}
                />
                <Button type="button" variant="outline" size="sm" onClick={addTerm}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              {invErrors.terms && <p className="mt-1 text-xs text-danger">{invErrors.terms}</p>}
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={saveInvoiceDefaults} disabled={savingInvoice}>
                {savingInvoice ? 'Saving…' : 'Save invoice defaults'}
              </Button>
            </div>
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
                      <AdminTableCell className="max-w-[360px] text-xs text-text-secondary [overflow-wrap:anywhere]">
                        {formatDetail(row.detail)}
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
