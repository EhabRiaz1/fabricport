import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { InvoicePreview } from '@/components/invoice/InvoicePreview'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useCounterparties } from '@/hooks/useCounterparties'
import { useProfile } from '@/hooks/useProfile'
import { useFxRate, convertPkrToUsd } from '@/lib/fx'
import { INQUIRY_BASE_SELECT, INQUIRY_ITEMS_SELECT, normalizeInquiry } from '@/lib/inquiries'
import { computeInvoiceTotals } from '@/lib/invoices'
import {
  DEFAULT_INVOICE_DEFAULTS,
  DEFAULT_PAYMENT_TERMS_OPTIONS,
  getSetting,
} from '@/lib/settings'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { Invoice, InvoiceLineItem, InvoiceTaxMode } from '@/types/database.types'

const INQUIRY_SELECT = `${INQUIRY_BASE_SELECT}, ${INQUIRY_ITEMS_SELECT}`
const MAX_QTY = 10_000_000

/** Form state for one line. Numbers are kept as text so a cleared input stays empty. */
interface DraftLine {
  key: string
  product_id: string
  title: string
  qty: string
  unitPrice: string
  /** Empty = use the invoice rate (per-line mode only). */
  taxRate: string
}

interface OwnProduct {
  id: string
  title: string
  price_min_pkr: number | null
}

let lineSeq = 0
function newLine(fields: Omit<DraftLine, 'key'>): DraftLine {
  lineSeq += 1
  return { key: `line-${lineSeq}`, ...fields }
}

function num(text: string): number {
  const n = Number(text)
  return text.trim() === '' || !Number.isFinite(n) ? NaN : n
}

function todayIso() {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export default function InvoiceBuilderPage() {
  const { profile } = useProfile()
  const profileId = profile?.id
  const navigate = useNavigate()
  const { nameOf } = useCounterparties()
  const fxRate = useFxRate()
  const [searchParams] = useSearchParams()
  const inquiryParam = searchParams.get('inquiry')
  const invoiceParam = searchParams.get('invoice')

  // Who and what the invoice is for.
  const [invoiceId, setInvoiceId] = useState<string | null>(null)
  const [inquiryId, setInquiryId] = useState<string | null>(null)
  const [buyerId, setBuyerId] = useState<string | null>(null)
  const [buyerFallback, setBuyerFallback] = useState('Buyer')
  const [supplierName, setSupplierName] = useState('Supplier')
  const [frozenStatus, setFrozenStatus] = useState<string | null>(null)

  // The editable invoice.
  const [lines, setLines] = useState<DraftLine[]>([])
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [taxRate, setTaxRate] = useState(String(DEFAULT_INVOICE_DEFAULTS.tax_rate_percent))
  const [taxMode, setTaxMode] = useState<InvoiceTaxMode>(DEFAULT_INVOICE_DEFAULTS.tax_mode)
  const [freight, setFreight] = useState(String(DEFAULT_INVOICE_DEFAULTS.freight_pkr))
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_INVOICE_DEFAULTS.payment_terms)
  const [termsOptions, setTermsOptions] = useState<string[]>(DEFAULT_PAYMENT_TERMS_OPTIONS)

  const [products, setProducts] = useState<OwnProduct[]>([])
  const [addKey, setAddKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profileId) return
    if (!inquiryParam && !invoiceParam) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const [defaults, options, productsRes] = await Promise.all([
        getSetting('invoice_defaults').catch(() => null),
        getSetting('invoice_payment_terms_options').catch(() => null),
        supabase
          .from('products')
          .select('id, title, price_min_pkr')
          .eq('supplier_id', profileId!)
          .neq('status', 'archived')
          .order('title'),
      ])
      if (cancelled) return
      if (Array.isArray(options) && options.length > 0) setTermsOptions(options)
      setProducts((productsRes.data ?? []) as OwnProduct[])

      if (invoiceParam) {
        const { data, error: fetchError } = await supabase
          .from('invoices')
          .select('*, supplier:suppliers(id, brand_name)')
          .eq('id', invoiceParam)
          .eq('supplier_id', profileId!)
          .maybeSingle()
        if (cancelled) return
        if (fetchError || !data) {
          setError(fetchError?.message ?? 'Invoice not found')
          setLoading(false)
          return
        }
        const inv = data as unknown as Invoice & { supplier?: { brand_name?: string } | null }
        setInvoiceId(inv.id)
        setInquiryId(inv.inquiry_id)
        setBuyerId(inv.buyer_id)
        setSupplierName(inv.supplier?.brand_name ?? profile?.company_name ?? 'Supplier')
        if (inv.status !== 'draft') setFrozenStatus(inv.status)
        setLines(
          (inv.line_items ?? []).map((item) =>
            newLine({
              product_id: item.product_id,
              title: item.title,
              qty: String(item.qty ?? ''),
              unitPrice: item.unit_price_pkr ? String(item.unit_price_pkr) : '',
              taxRate: item.tax_rate_percent == null ? '' : String(item.tax_rate_percent),
            }),
          ),
        )
        setNotes(inv.notes ?? '')
        setDueDate(inv.due_date ?? '')
        setTaxRate(String(inv.tax_rate_percent ?? 0))
        setTaxMode(inv.tax_mode ?? 'total')
        setFreight(String(inv.freight_pkr ?? 0))
        setPaymentTerms(inv.payment_terms ?? '')
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('inquiries')
        .select(INQUIRY_SELECT)
        .eq('id', inquiryParam!)
        .eq('supplier_id', profileId!)
        .maybeSingle()
      if (cancelled) return
      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Inquiry not found')
        setLoading(false)
        return
      }
      const inq = normalizeInquiry(data as Record<string, unknown>)
      setInvoiceId(null)
      setInquiryId(inq.id)
      setBuyerId(inq.buyer_id)
      setBuyerFallback(inq.buyer?.company_name ?? inq.buyer?.full_name ?? 'Buyer')
      setSupplierName(inq.supplier?.brand_name ?? profile?.company_name ?? 'Supplier')
      setLines(
        (inq.items ?? []).map((item) =>
          newLine({
            product_id: item.product_id,
            title: item.product?.title ?? 'Product',
            qty: String(item.quantity_meters ?? ''),
            unitPrice: item.product?.price_min_pkr ? String(item.product.price_min_pkr) : '',
            taxRate: '',
          }),
        ),
      )
      const d = { ...DEFAULT_INVOICE_DEFAULTS, ...(defaults ?? {}) }
      setTaxRate(String(d.tax_rate_percent ?? 0))
      setTaxMode(d.tax_mode === 'per_line' ? 'per_line' : 'total')
      setFreight(String(d.freight_pkr ?? 0))
      setPaymentTerms(d.payment_terms ?? '')
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
    // profile.company_name is only a display fallback; reloading on it would wipe edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquiryParam, invoiceParam, profileId])

  const invoiceRate = num(taxRate)
  const freightPkr = num(freight)

  /** Inline validation messages, keyed by field. */
  const issues = useMemo(() => {
    const out: Record<string, string> = {}
    if (lines.length === 0) out.lines = 'Add at least one line.'
    for (const line of lines) {
      const qty = num(line.qty)
      if (!(qty > 0)) out[`${line.key}.qty`] = 'Quantity must be greater than 0.'
      else if (qty > MAX_QTY) out[`${line.key}.qty`] = 'Quantity is too large.'
      const price = num(line.unitPrice)
      if (!(price > 0)) out[`${line.key}.price`] = 'Unit price must be greater than 0.'
      if (taxMode === 'per_line' && line.taxRate.trim() !== '') {
        const r = num(line.taxRate)
        if (!(r >= 0 && r <= 100)) out[`${line.key}.tax`] = 'Tax rate must be 0–100%.'
      }
    }
    if (!(invoiceRate >= 0 && invoiceRate <= 100)) out.taxRate = 'Tax rate must be between 0 and 100%.'
    if (!(freightPkr >= 0)) out.freight = 'Freight cannot be negative.'
    if (dueDate && dueDate < todayIso() && !invoiceId) out.dueDate = 'Due date cannot be in the past.'
    return out
  }, [lines, taxMode, invoiceRate, freightPkr, dueDate, invoiceId])
  const hasIssues = Object.keys(issues).length > 0

  /** Lines in the stored shape (only meaningful once validation passes). */
  const lineItems = useMemo<InvoiceLineItem[]>(
    () =>
      lines.map((line) => {
        const qty = num(line.qty) || 0
        const unit = num(line.unitPrice) || 0
        const unitUsd = fxRate ? Math.round(convertPkrToUsd(unit, fxRate) * 100) / 100 : 0
        const item: InvoiceLineItem = {
          product_id: line.product_id,
          title: line.title,
          qty,
          unit_price_pkr: unit,
          unit_price_usd: unitUsd,
          total_pkr: qty * unit,
          total_usd: Math.round(qty * unitUsd * 100) / 100,
        }
        if (taxMode === 'per_line' && line.taxRate.trim() !== '') {
          item.tax_rate_percent = num(line.taxRate)
        }
        return item
      }),
    [lines, fxRate, taxMode],
  )

  const totals = useMemo(
    () =>
      computeInvoiceTotals({
        lines: lineItems,
        taxMode,
        taxRatePercent: invoiceRate >= 0 ? invoiceRate : 0,
        freightPkr: freightPkr >= 0 ? freightPkr : 0,
      }),
    [lineItems, taxMode, invoiceRate, freightPkr],
  )

  function patchLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function addProduct(productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setLines((prev) => [
      ...prev,
      newLine({
        product_id: product.id,
        title: product.title,
        qty: '1',
        unitPrice: product.price_min_pkr ? String(product.price_min_pkr) : '',
        taxRate: '',
      }),
    ])
    setAddKey((k) => k + 1)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    // Synchronous guard: a double click fires twice before `saving` re-renders.
    if (savingRef.current || !profileId || !buyerId || !inquiryId || frozenStatus) return
    setSubmitted(true)
    if (hasIssues) {
      setError('Fix the highlighted fields before saving.')
      return
    }
    savingRef.current = true
    setSaving(true)
    setError(null)

    // Subtotal, tax and total are computed by the database trigger from these fields.
    const fields = {
      line_items: lineItems,
      notes: notes.trim() || null,
      due_date: dueDate || null,
      tax_rate_percent: invoiceRate,
      tax_mode: taxMode,
      freight_pkr: freightPkr,
      payment_terms: paymentTerms.trim() || null,
    }

    const result = invoiceId
      ? await supabase
          .from('invoices')
          .update(fields)
          .eq('id', invoiceId)
          .eq('status', 'draft')
          .select('id')
          .maybeSingle()
      : await supabase
          .from('invoices')
          .insert({
            ...fields,
            inquiry_id: inquiryId,
            supplier_id: profileId,
            buyer_id: buyerId,
            status: 'draft',
          })
          .select('id')
          .single()

    if (result.error || !result.data) {
      const message =
        result.error?.message ??
        'This invoice is no longer a draft, so it cannot be edited. Reload the invoices list.'
      setError(message)
      toast.error('Could not save draft', message)
      savingRef.current = false
      setSaving(false)
      return
    }

    toast.success('Draft saved', 'Review it in your invoices list, then send it to the buyer.')
    navigate(`/supplier-portal/invoices?highlight=${result.data.id}`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if ((!inquiryParam && !invoiceParam) || !inquiryId || !buyerId) {
    return (
      <div className="text-center">
        <p className="text-text-secondary">{error ?? 'Select an inquiry to build an invoice.'}</p>
        <Link
          to="/supplier-portal/inquiries"
          className="mt-4 inline-block text-accent hover:underline"
        >
          View inquiries
        </Link>
      </div>
    )
  }

  if (frozenStatus) {
    return (
      <div className="text-center">
        <p className="text-text-secondary">
          This invoice is {frozenStatus} and can no longer be edited.
        </p>
        <Link
          to={`/supplier-portal/invoices?highlight=${invoiceId}`}
          className="mt-4 inline-block text-accent hover:underline"
        >
          Back to invoices
        </Link>
      </div>
    )
  }

  const buyerName = nameOf(buyerId, buyerFallback)
  const showError = (field: string) => (submitted ? issues[field] : undefined)
  const inputClass = 'border-border-cream bg-card text-text-dark'
  const allTermsOptions =
    paymentTerms && !termsOptions.includes(paymentTerms)
      ? [paymentTerms, ...termsOptions]
      : termsOptions
  const productsNotYetAdded = products.filter((p) => !lines.some((l) => l.product_id === p.id))

  return (
    <div className="space-y-6">
      <Link
        to={invoiceId ? '/supplier-portal/invoices' : `/supplier-portal/inquiries/${inquiryId}`}
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        {invoiceId ? 'Back to invoices' : 'Back to inquiry'}
      </Link>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Invoice</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          {invoiceId ? 'Edit draft invoice' : 'Invoice Builder'}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">For {buyerName}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-text-dark">Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4" noValidate>
              {lines.map((line) => {
                const qtyError = showError(`${line.key}.qty`)
                const priceError = showError(`${line.key}.price`)
                const taxError = showError(`${line.key}.tax`)
                const unit = num(line.unitPrice)
                return (
                  <div
                    key={line.key}
                    className="space-y-3 border border-border-cream bg-card-hover p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-text-dark">{line.title}</p>
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        className="text-text-dark-secondary hover:text-danger"
                        aria-label={`Remove ${line.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div
                      className={
                        taxMode === 'per_line'
                          ? 'grid gap-3 sm:grid-cols-[1fr_1fr_90px]'
                          : 'grid gap-3 sm:grid-cols-2'
                      }
                    >
                      <div className="space-y-1">
                        <Label className="font-mono text-[10px] uppercase text-text-dark-secondary">
                          Quantity (m)
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          inputMode="numeric"
                          value={line.qty}
                          onChange={(e) => patchLine(line.key, { qty: e.target.value })}
                          aria-invalid={!!qtyError}
                          className={inputClass}
                        />
                        {qtyError && <p className="text-xs text-danger">{qtyError}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="font-mono text-[10px] uppercase text-text-dark-secondary">
                          Unit price (PKR / m)
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          value={line.unitPrice}
                          onChange={(e) => patchLine(line.key, { unitPrice: e.target.value })}
                          aria-invalid={!!priceError}
                          className={inputClass}
                        />
                        {priceError ? (
                          <p className="text-xs text-danger">{priceError}</p>
                        ) : (
                          fxRate &&
                          unit > 0 && (
                            <p className="text-xs text-text-dark-secondary">
                              ≈ {formatPrice(convertPkrToUsd(unit, fxRate), 'USD')} / m
                            </p>
                          )
                        )}
                      </div>
                      {taxMode === 'per_line' && (
                        <div className="space-y-1">
                          <Label className="font-mono text-[10px] uppercase text-text-dark-secondary">
                            Tax %
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="any"
                            value={line.taxRate}
                            placeholder={taxRate}
                            onChange={(e) => patchLine(line.key, { taxRate: e.target.value })}
                            aria-invalid={!!taxError}
                            className={inputClass}
                          />
                          {taxError && <p className="text-xs text-danger">{taxError}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {showError('lines') && <p className="text-sm text-danger">{issues.lines}</p>}

              {productsNotYetAdded.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-text-dark">Add a line from your fabrics</Label>
                  <Select key={addKey} onValueChange={addProduct}>
                    <SelectTrigger className="border-border-cream bg-card-hover text-text-dark">
                      <SelectValue placeholder="Choose a fabric" />
                    </SelectTrigger>
                    <SelectContent>
                      {productsNotYetAdded.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                          {p.price_min_pkr ? ` · ${formatPrice(p.price_min_pkr, 'PKR')}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-4 border-t border-border-cream pt-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-text-dark">Tax applied</Label>
                  <div className="flex gap-2">
                    {(['total', 'per_line'] as const).map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        size="sm"
                        variant={taxMode === mode ? 'default' : 'outline'}
                        className={taxMode === mode ? undefined : 'border-border-cream text-text-dark'}
                        onClick={() => setTaxMode(mode)}
                        aria-pressed={taxMode === mode}
                      >
                        {mode === 'total' ? 'On total' : 'Per line'}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="taxRate" className="text-text-dark">
                    {taxMode === 'per_line' ? 'Default tax rate (%)' : 'Tax rate (%)'}
                  </Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    aria-invalid={!!showError('taxRate')}
                    className={inputClass}
                  />
                  {showError('taxRate') && (
                    <p className="text-xs text-danger">{issues.taxRate}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="freight" className="text-text-dark">
                    Freight (PKR)
                  </Label>
                  <Input
                    id="freight"
                    type="number"
                    min={0}
                    step="any"
                    value={freight}
                    onChange={(e) => setFreight(e.target.value)}
                    aria-invalid={!!showError('freight')}
                    className={inputClass}
                  />
                  {showError('freight') && (
                    <p className="text-xs text-danger">{issues.freight}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dueDate" className="text-text-dark">
                    Due date
                  </Label>
                  <Input
                    id="dueDate"
                    type="date"
                    min={todayIso()}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    aria-invalid={!!showError('dueDate')}
                    className={inputClass}
                  />
                  {showError('dueDate') ? (
                    <p className="text-xs text-danger">{issues.dueDate}</p>
                  ) : (
                    !dueDate && (
                      <p className="text-xs text-text-dark-secondary">
                        Leave blank for 30 days after sending.
                      </p>
                    )
                  )}
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-text-dark">Payment terms</Label>
                  <Select value={paymentTerms || undefined} onValueChange={setPaymentTerms}>
                    <SelectTrigger className="border-border-cream bg-card-hover text-text-dark">
                      <SelectValue placeholder="Choose payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      {allTermsOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-text-dark">
                  Notes for the buyer
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bank details, delivery terms, anything else the buyer should know"
                  className="border-border-cream bg-card-hover text-text-dark"
                />
              </div>

              <div className="space-y-1 border-t border-border-cream pt-4 text-sm">
                <TotalRow label="Subtotal" value={formatPrice(totals.subtotalPkr, 'PKR')} />
                <TotalRow
                  label={taxMode === 'per_line' ? 'Tax (per line)' : `Tax (${taxRate || 0}%)`}
                  value={formatPrice(totals.taxPkr, 'PKR')}
                />
                <TotalRow label="Freight" value={formatPrice(freightPkr || 0, 'PKR')} />
                <div className="flex items-center justify-between pt-2">
                  <span className="text-text-dark">Total</span>
                  <span className="font-display text-lg font-semibold text-text-dark">
                    {formatPrice(totals.totalPkr, 'PKR')}
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Draft'}
                </Button>
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-text-dark">PDF Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <InvoicePreview
              invoiceNumber={(invoiceId ?? inquiryId).slice(0, 8).toUpperCase()}
              supplierName={supplierName}
              buyerName={buyerName}
              lineItems={lineItems}
              subtotalPkr={totals.subtotalPkr}
              subtotalUsd={totals.subtotalUsd}
              taxMode={taxMode}
              taxRatePercent={invoiceRate >= 0 ? invoiceRate : 0}
              taxPkr={totals.taxPkr}
              freightPkr={freightPkr >= 0 ? freightPkr : 0}
              totalPkr={totals.totalPkr}
              paymentTerms={paymentTerms || undefined}
              dueDate={dueDate || undefined}
              notes={notes}
              createdAt={new Date().toISOString()}
              status="draft"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-dark-secondary">{label}</span>
      <span className="text-text-dark">{value}</span>
    </div>
  )
}
