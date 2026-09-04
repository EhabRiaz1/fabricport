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
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'
import type { ProductWithRelations } from '@/types/app'
import type { ProductVisibility } from '@/types/database.types'

export interface ProductDraft {
  stock: string
  priceMin: string
  priceMax: string
  moq: string
  leadTime: string
  description: string
  visibility: ProductVisibility
  sampleAvailable: boolean
}

export function draftFromProduct(product: ProductWithRelations): ProductDraft {
  return {
    stock: String(product.stock_meters),
    priceMin: product.price_min_pkr != null ? String(product.price_min_pkr) : '',
    priceMax: product.price_max_pkr != null ? String(product.price_max_pkr) : '',
    moq: product.moq_meters != null ? String(product.moq_meters) : '',
    leadTime: product.lead_time_days != null ? String(product.lead_time_days) : '',
    description: product.description ?? '',
    visibility: product.visibility,
    sampleAvailable: product.sample_available,
  }
}

/**
 * Writes a supplier's edits to one product.
 *
 * Shared by the inventory grid (through the dialog below) and the inventory list (which
 * still edits in place), so the `price_approved: false` re-open rule lives in exactly one
 * place. The DB guard trigger enforces the same rule server-side; this is the UI half.
 */
export async function saveProductDraft(
  productId: string,
  draft: ProductDraft,
): Promise<boolean> {
  const { error } = await supabase
    .from('products')
    .update({
      stock_meters: Number(draft.stock) || 0,
      price_min_pkr: draft.priceMin ? Number(draft.priceMin) : null,
      price_max_pkr: draft.priceMax ? Number(draft.priceMax) : null,
      moq_meters: draft.moq ? Number(draft.moq) : null,
      lead_time_days: draft.leadTime ? Number(draft.leadTime) : null,
      description: draft.description.trim() || null,
      visibility: draft.visibility,
      sample_available: draft.sampleAvailable,
      // Price edits re-open approval (also enforced by the DB guard trigger).
      price_approved: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)

  if (error) {
    toast.error('Update failed', error.message)
    return false
  }
  toast.success('Product updated', 'Price changes require admin approval.')
  return true
}

export interface ProductEditDialogProps {
  /** Null closes the dialog. */
  product: ProductWithRelations | null
  onOpenChange: (open: boolean) => void
  /** Called after a successful save so the caller can refetch. */
  onSaved: () => void | Promise<void>
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

  // Reset on every product change, so reopening never shows the previous fabric's numbers.
  useEffect(() => {
    setDraft(product ? draftFromProduct(product) : null)
  }, [product])

  function update(patch: Partial<ProductDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  async function handleSave() {
    if (!product || !draft) return
    setSaving(true)
    const ok = await saveProductDraft(product.id, draft)
    setSaving(false)
    if (ok) {
      await onSaved()
      onOpenChange(false)
    }
  }

  if (!product || !draft) return null

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
          <Field label="Stock (m)">
            <Input
              type="number"
              min={0}
              value={draft.stock}
              onChange={(e) => update({ stock: e.target.value })}
              className="border-border-cream bg-card-hover text-text-dark"
            />
          </Field>
          <Field label="Min Price PKR">
            <Input
              type="number"
              min={0}
              value={draft.priceMin}
              onChange={(e) => update({ priceMin: e.target.value })}
              className="border-border-cream bg-card-hover text-text-dark"
            />
          </Field>
          <Field label="Max Price PKR">
            <Input
              type="number"
              min={0}
              value={draft.priceMax}
              onChange={(e) => update({ priceMax: e.target.value })}
              className="border-border-cream bg-card-hover text-text-dark"
            />
          </Field>
          <Field label="MOQ (m)">
            <Input
              type="number"
              min={0}
              value={draft.moq}
              onChange={(e) => update({ moq: e.target.value })}
              className="border-border-cream bg-card-hover text-text-dark"
            />
          </Field>
          <Field label="Lead time (days)">
            <Input
              type="number"
              min={0}
              value={draft.leadTime}
              onChange={(e) => update({ leadTime: e.target.value })}
              className="border-border-cream bg-card-hover text-text-dark"
            />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
        {label}
      </span>
      {children}
    </label>
  )
}

export default ProductEditDialog
