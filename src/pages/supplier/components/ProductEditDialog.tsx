import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getAttributeValue, getComposition, getGsm, getWidth } from '@/lib/product-specs'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'
import type { ProductWithRelations } from '@/types/app'
import type { ProductVisibility } from '@/types/database.types'

/**
 * Inventory query shape. The attribute join is what lets the product-specs helpers fall
 * back to the legacy EAV rows (GSM, width, composition) when the promoted columns are null.
 */
export const INVENTORY_PRODUCT_SELECT =
  '*, category:fabric_categories(*), attributes:product_attributes(id, attribute_id, value_text, value_number, attribute:fabric_attributes(id, slug, name, unit))'

export interface ProductDraft {
  stock: string
  priceMin: string
  priceMax: string
  moq: string
  leadTime: string
  gsm: string
  width: string
  composition: string
  weave: string
  description: string
  visibility: ProductVisibility
  sampleAvailable: boolean
  running: boolean
}

export type DraftErrors = Partial<Record<keyof ProductDraft, string>>

export function draftFromProduct(product: ProductWithRelations): ProductDraft {
  return {
    stock: String(product.stock_meters),
    priceMin: product.price_min_pkr != null ? String(product.price_min_pkr) : '',
    priceMax: product.price_max_pkr != null ? String(product.price_max_pkr) : '',
    moq: product.moq_meters != null ? String(product.moq_meters) : '',
    leadTime: product.lead_time_days != null ? String(product.lead_time_days) : '',
    gsm: product.gsm != null ? String(product.gsm) : '',
    width: product.width_inches != null ? String(product.width_inches) : '',
    composition: product.composition ?? '',
    weave: getAttributeValue(product, 'weave') ?? '',
    description: product.description ?? '',
    visibility: product.visibility,
    sampleAvailable: product.sample_available,
    running: product.is_running,
  }
}

/** Empty → null; anything else → a number (NaN when it is not one). */
function optionalNumber(text: string): number | null {
  return text.trim() === '' ? null : Number(text)
}

/** Inline errors for a draft. Mirrors the products CHECK constraints (migration 20261027150000). */
export function validateDraft(draft: ProductDraft): DraftErrors {
  const errors: DraftErrors = {}
  const stock = optionalNumber(draft.stock)
  if (stock == null || !Number.isFinite(stock)) errors.stock = 'Enter the stock in metres (0 or more).'
  else if (stock < 0) errors.stock = 'Stock cannot be negative.'

  const moq = optionalNumber(draft.moq)
  if (moq != null && !(moq >= 0)) errors.moq = 'MOQ cannot be negative.'

  const min = optionalNumber(draft.priceMin)
  const max = optionalNumber(draft.priceMax)
  if (min != null && !(min >= 0)) errors.priceMin = 'Price cannot be negative.'
  if (max != null && !(max >= 0)) errors.priceMax = 'Price cannot be negative.'
  if (min != null && max != null && min >= 0 && max >= 0 && max < min) {
    errors.priceMax = 'Max price must be at least the min price.'
  }

  const lead = optionalNumber(draft.leadTime)
  if (lead != null && !(lead >= 0)) errors.leadTime = 'Lead time cannot be negative.'

  const gsm = optionalNumber(draft.gsm)
  if (gsm != null && !(gsm > 0)) errors.gsm = 'GSM must be greater than 0.'
  const width = optionalNumber(draft.width)
  if (width != null && !(width > 0)) errors.width = 'Width must be greater than 0.'
  return errors
}

export interface WeaveAttribute {
  id: string
  options: string[]
}

/** The `weave` fabric attribute (id + its option list), or null if it does not exist. */
export function useWeaveAttribute(): WeaveAttribute | null {
  const [attr, setAttr] = useState<WeaveAttribute | null>(null)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('fabric_attributes')
      .select('id, options')
      .eq('slug', 'weave')
      .order('display_order')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        const options = Array.isArray(data.options)
          ? data.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '')
          : []
        setAttr({ id: data.id, options })
      })
    return () => {
      cancelled = true
    }
  }, [])
  return attr
}

/**
 * Writes a supplier's edits to one product and returns the fresh row (with the
 * inventory joins), or null on failure.
 *
 * Shared by the inventory grid (through the dialog below) and the inventory list (which
 * still edits in place). `price_approved: false` is only sent when a price actually
 * changed -- saving stock or a description must not knock an approved price back into
 * the admin queue. The DB guard trigger applies the same rule server-side.
 */
export async function saveProductDraft(
  product: ProductWithRelations,
  draft: ProductDraft,
  weaveAttributeId?: string | null,
): Promise<ProductWithRelations | null> {
  const errors = validateDraft(draft)
  if (Object.keys(errors).length > 0) {
    toast.error('Check the highlighted fields', Object.values(errors)[0])
    return null
  }

  const priceMin = optionalNumber(draft.priceMin)
  const priceMax = optionalNumber(draft.priceMax)
  const priceChanged =
    priceMin !== (product.price_min_pkr ?? null) || priceMax !== (product.price_max_pkr ?? null)

  const { error } = await supabase
    .from('products')
    .update({
      stock_meters: Number(draft.stock),
      price_min_pkr: priceMin,
      price_max_pkr: priceMax,
      moq_meters: optionalNumber(draft.moq),
      lead_time_days: optionalNumber(draft.leadTime),
      gsm: optionalNumber(draft.gsm),
      width_inches: optionalNumber(draft.width),
      composition: draft.composition.trim() || null,
      description: draft.description.trim() || null,
      visibility: draft.visibility,
      sample_available: draft.sampleAvailable,
      is_running: draft.running,
      ...(priceChanged ? { price_approved: false } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', product.id)

  if (error) {
    toast.error('Update failed', error.message)
    return null
  }

  // Weave lives in product_attributes (the spec_facets trigger picks it up from there).
  let weaveError: string | null = null
  const weave = draft.weave.trim()
  const currentWeave = getAttributeValue(product, 'weave') ?? ''
  if (weaveAttributeId && weave !== currentWeave) {
    const { error: attrError } = weave
      ? await supabase
          .from('product_attributes')
          .upsert(
            {
              product_id: product.id,
              attribute_id: weaveAttributeId,
              value_text: weave,
              value_number: null,
            },
            { onConflict: 'product_id,attribute_id' },
          )
      : await supabase
          .from('product_attributes')
          .delete()
          .eq('product_id', product.id)
          .eq('attribute_id', weaveAttributeId)
    weaveError = attrError?.message ?? null
  }

  const { data: fresh } = await supabase
    .from('products')
    .select(INVENTORY_PRODUCT_SELECT)
    .eq('id', product.id)
    .maybeSingle()

  if (weaveError) {
    toast.error('Saved, but the weave could not be updated', weaveError)
  } else if (priceChanged) {
    toast.success('Product updated', 'The new price is waiting for admin approval.')
  } else {
    toast.success('Product updated')
  }
  return (fresh as ProductWithRelations | null) ?? { ...product }
}

export interface ProductEditDialogProps {
  /** Null closes the dialog. */
  product: ProductWithRelations | null
  onOpenChange: (open: boolean) => void
  /** Called with the fresh row after a successful save, so the caller can update in place. */
  onSaved: (product: ProductWithRelations) => void | Promise<void>
}

/**
 * The inventory edit form, in a dialog.
 *
 * The grid view has no room for eleven fields per fabric, so the fields it cannot show
 * live here. Same inputs, same save path and same validation as the list view, lifted out
 * of `InventoryPage` verbatim rather than reimplemented.
 */
export function ProductEditDialog({
  product,
  onOpenChange,
  onSaved,
}: ProductEditDialogProps) {
  const [draft, setDraft] = useState<ProductDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const weaveAttr = useWeaveAttribute()

  // Reset on every product change, so reopening never shows the previous fabric's numbers.
  useEffect(() => {
    setDraft(product ? draftFromProduct(product) : null)
    setShowErrors(false)
  }, [product])

  function update(patch: Partial<ProductDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  async function handleSave() {
    if (!product || !draft || saving) return
    if (Object.keys(validateDraft(draft)).length > 0) {
      setShowErrors(true)
      return
    }
    setSaving(true)
    const saved = await saveProductDraft(product, draft, weaveAttr?.id)
    setSaving(false)
    if (saved) {
      await onSaved(saved)
      onOpenChange(false)
    }
  }

  if (!product || !draft) return null
  const errors = showErrors ? validateDraft(draft) : {}
  const inputClass = 'border-border-cream bg-card-hover text-text-dark'
  const gsmHint = product.gsm == null ? getGsm(product) : null
  const widthHint = product.width_inches == null ? getWidth(product) : null
  const compositionHint = product.composition == null ? getComposition(product) : null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto bg-card p-6 text-text-dark sm:w-full">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-text-dark">{product.title}</DialogTitle>
          <DialogDescription className="text-text-dark-secondary">
            {product.category?.name ?? 'Uncategorized'} · edits to price re-open admin
            approval.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            label="Stock (m)"
            value={draft.stock}
            error={errors.stock}
            onChange={(v) => update({ stock: v })}
          />
          <NumberField
            label="Min Price PKR"
            value={draft.priceMin}
            error={errors.priceMin}
            onChange={(v) => update({ priceMin: v })}
          />
          <NumberField
            label="Max Price PKR"
            value={draft.priceMax}
            error={errors.priceMax}
            onChange={(v) => update({ priceMax: v })}
          />
          <NumberField
            label="MOQ (m)"
            value={draft.moq}
            error={errors.moq}
            onChange={(v) => update({ moq: v })}
          />
          <NumberField
            label="Lead time (days)"
            value={draft.leadTime}
            error={errors.leadTime}
            onChange={(v) => update({ leadTime: v })}
          />
          <NumberField
            label="GSM (g/m²)"
            value={draft.gsm}
            error={errors.gsm}
            placeholder={gsmHint != null ? String(gsmHint) : undefined}
            onChange={(v) => update({ gsm: v })}
          />
          <NumberField
            label="Width (inches)"
            value={draft.width}
            error={errors.width}
            placeholder={widthHint ?? undefined}
            onChange={(v) => update({ width: v })}
          />
          <Field label="Composition">
            <Input
              value={draft.composition}
              placeholder={compositionHint ?? 'e.g. 100% Cotton'}
              onChange={(e) => update({ composition: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Weave">
            {weaveAttr && weaveAttr.options.length > 0 ? (
              <select
                value={draft.weave}
                onChange={(e) => update({ weave: e.target.value })}
                className="h-10 w-full border border-border-cream bg-card-hover px-3 text-sm text-text-dark"
              >
                <option value="">Not set</option>
                {draft.weave && !weaveAttr.options.includes(draft.weave) && (
                  <option value={draft.weave}>{draft.weave}</option>
                )}
                {weaveAttr.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={draft.weave}
                placeholder="e.g. Twill"
                disabled={!weaveAttr}
                onChange={(e) => update({ weave: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Visibility">
            <select
              value={draft.visibility}
              onChange={(e) =>
                update({ visibility: e.target.value as ProductVisibility })
              }
              className="h-10 w-full border border-border-cream bg-card-hover px-3 text-sm text-text-dark"
            >
              <option value="public">Public — visible to everyone</option>
              <option value="private">Private — share by link only</option>
            </select>
          </Field>
        </div>

        <label className="flex w-fit items-center gap-2 text-sm text-text-dark">
          <input
            type="checkbox"
            checked={draft.sampleAvailable}
            onChange={(e) => update({ sampleAvailable: e.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Sample available
        </label>

        <label className="flex w-fit items-center gap-2 text-sm text-text-dark">
          <input
            type="checkbox"
            checked={draft.running}
            onChange={(e) => update({ running: e.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Running fabric
        </label>

        <Field label="Description">
          <Textarea
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Fabric details buyers should know…"
            className="min-h-[90px] border-border-cream bg-card-hover text-text-dark"
          />
        </Field>

        <div className="flex items-center justify-between gap-4 border-t border-border-cream pt-4">
          {!product.price_approved && product.price_min_pkr != null ? (
            <p className="text-xs text-warning">Price pending admin approval</p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  )
}

export function NumberField({
  label,
  value,
  error,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  error?: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <Field label={label} error={error}>
      <Input
        type="number"
        min={0}
        step="any"
        value={value}
        placeholder={placeholder}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
        className={
          error
            ? 'border-danger bg-card-hover text-text-dark'
            : 'border-border-cream bg-card-hover text-text-dark'
        }
      />
    </Field>
  )
}

export default ProductEditDialog
