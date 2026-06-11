import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { InvoicePreview } from '@/components/invoice/InvoicePreview'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfile } from '@/hooks/useProfile'
import { getFxRate, convertPkrToUsd } from '@/lib/fx'
import { INQUIRY_BASE_SELECT, INQUIRY_ITEMS_SELECT, normalizeInquiry } from '@/lib/inquiries'
import { supabase } from '@/lib/supabase'
import type { InvoiceBuilderLineItem, InquiryWithRelations } from '@/types/app'

const INQUIRY_SELECT = `${INQUIRY_BASE_SELECT}, ${INQUIRY_ITEMS_SELECT}`

export default function InvoiceBuilderPage() {
  const { profile } = useProfile()
  const [searchParams] = useSearchParams()
  const inquiryId = searchParams.get('inquiry')
  const [inquiry, setInquiry] = useState<InquiryWithRelations | null>(null)
  const [lineItems, setLineItems] = useState<InvoiceBuilderLineItem[]>([])
  const [notes, setNotes] = useState('')
  const [fxRate, setFxRate] = useState(278)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getFxRate().then(setFxRate).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!inquiryId || !profile?.id) {
      setLoading(false)
      return
    }

    const selectedInquiryId = inquiryId

    async function load() {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('inquiries')
        .select(INQUIRY_SELECT)
        .eq('id', selectedInquiryId)
        .eq('supplier_id', profile!.id)
        .maybeSingle()

      if (fetchError || !data) {
        setError(fetchError?.message ?? 'Inquiry not found')
        setInquiry(null)
      } else {
        const inq = normalizeInquiry(data as Record<string, unknown>)
        setInquiry(inq)
        setLineItems(
          (inq.items ?? []).map((item) => ({
            product_id: item.product_id,
            title: item.product?.title ?? 'Product',
            qty: item.quantity_meters ?? 0,
            unit_price_pkr: item.product?.price_min_pkr ?? 0,
            unit_price_usd: convertPkrToUsd(item.product?.price_min_pkr ?? 0, fxRate),
          })),
        )
      }
      setLoading(false)
    }

    load()
  }, [inquiryId, profile?.id, fxRate])

  const subtotals = useMemo(() => {
    const subtotalPkr = lineItems.reduce(
      (sum, item) => sum + item.qty * item.unit_price_pkr,
      0,
    )
    const subtotalUsd = lineItems.reduce(
      (sum, item) => sum + item.qty * item.unit_price_usd,
      0,
    )
    return { subtotalPkr, subtotalUsd }
  }, [lineItems])

  function updateLineItem(index: number, unitPricePkr: number) {
    setLineItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              unit_price_pkr: unitPricePkr,
              unit_price_usd: convertPkrToUsd(unitPricePkr, fxRate),
            }
          : item,
      ),
    )
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!inquiry || !profile?.id) return

    setSaving(true)
    setError(null)

    const invoiceLineItems = lineItems.map((item) => ({
      product_id: item.product_id,
      title: item.title,
      qty: item.qty,
      unit_price_pkr: item.unit_price_pkr,
      unit_price_usd: item.unit_price_usd,
      total_pkr: item.qty * item.unit_price_pkr,
      total_usd: item.qty * item.unit_price_usd,
    }))

    const { error: insertError } = await supabase.from('invoices').insert({
      inquiry_id: inquiry.id,
      supplier_id: profile.id,
      buyer_id: inquiry.buyer_id,
      line_items: invoiceLineItems,
      subtotal_pkr: subtotals.subtotalPkr,
      subtotal_usd: subtotals.subtotalUsd,
      notes: notes.trim() || null,
      status: 'draft',
    })

    if (insertError) {
      setError(insertError.message)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!inquiryId || !inquiry) {
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

  const buyerName =
    inquiry.buyer?.company_name ?? inquiry.buyer?.full_name ?? 'Buyer'
  const supplierName = inquiry.supplier?.brand_name ?? 'Supplier'

  return (
    <div className="space-y-6">
      <Link
        to={`/supplier-portal/inquiries/${inquiry.id}`}
        className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to inquiry
      </Link>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Invoice</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Invoice Builder
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-text-dark">Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              {lineItems.map((item, index) => (
                <div
                  key={item.product_id}
                  className="grid gap-3 border border-border-cream bg-card-hover p-4 sm:grid-cols-[1fr_100px_120px]"
                >
                  <div>
                    <p className="text-sm font-medium text-text-dark">{item.title}</p>
                    <p className="text-xs text-text-dark-secondary">{item.qty}m</p>
                  </div>
                  <div>
                    <Label className="font-mono text-[10px] uppercase text-text-dark-secondary">
                      Unit PKR
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={item.unit_price_pkr}
                      onChange={(e) => updateLineItem(index, Number(e.target.value) || 0)}
                      className="border-border-cream bg-card text-text-dark"
                    />
                  </div>
                  <div className="flex items-end">
                    <p className="text-sm text-text-dark-secondary">
                      ${item.unit_price_usd.toFixed(2)}/m
                    </p>
                  </div>
                </div>
              ))}

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-text-dark">
                  Invoice Notes
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border-border-cream bg-card-hover text-text-dark"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border-cream pt-4">
                <div>
                  <p className="text-sm text-text-dark-secondary">Subtotal</p>
                  <p className="font-display text-lg font-semibold text-text-dark">
                    PKR {subtotals.subtotalPkr.toLocaleString()} · $
                    {subtotals.subtotalUsd.toFixed(2)}
                  </p>
                </div>
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
              invoiceNumber={inquiry.id.slice(0, 8).toUpperCase()}
              supplierName={supplierName}
              buyerName={buyerName}
              lineItems={lineItems.map((item) => ({
                ...item,
                total_pkr: item.qty * item.unit_price_pkr,
                total_usd: item.qty * item.unit_price_usd,
              }))}
              subtotalPkr={subtotals.subtotalPkr}
              subtotalUsd={subtotals.subtotalUsd}
              notes={notes}
              createdAt={new Date().toISOString()}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
