import { useEffect, useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  AddressFields,
  EMPTY_ADDRESS,
  fetchAddresses,
  formatAddressLine,
  insertAddress,
  isAddressComplete,
  type AddressFormValues,
} from '@/components/buyer/AddressBook'
import { createSampleRequest } from '@/lib/samples'
import { dispatchNotification } from '@/lib/notifications'
import { cn } from '@/lib/utils'
import type { ShippingAddress } from '@/types/database.types'
import type { ProductWithRelations } from '@/types/app'

export interface SampleRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: ProductWithRelations
  buyerId: string
  onSubmitted: (sampleRequestId: string) => void
}

export function SampleRequestDialog({
  open,
  onOpenChange,
  product,
  buyerId,
  onSubmitted,
}: SampleRequestDialogProps) {
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  // First-time buyers add an address right here rather than being bounced to
  // Settings and losing the product they were looking at.
  const [newAddress, setNewAddress] = useState<AddressFormValues>(EMPTY_ADDRESS)
  const [addingNew, setAddingNew] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await fetchAddresses(buyerId)
        if (cancelled) return
        setAddresses(rows)
        setSelectedId(rows.find((a) => a.is_default)?.id ?? rows[0]?.id ?? null)
        setAddingNew(rows.length === 0)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load addresses')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open, buyerId])

  async function handleSubmit() {
    if (!product.supplier) return
    setSubmitting(true)
    setError(null)

    try {
      let address = addresses.find((a) => a.id === selectedId)

      if (addingNew) {
        if (!isAddressComplete(newAddress)) {
          setError('Recipient name, address line 1 and city are required.')
          setSubmitting(false)
          return
        }
        address = await insertAddress(buyerId, newAddress, addresses.length === 0)
      }

      if (!address) {
        setError('Choose a delivery address.')
        setSubmitting(false)
        return
      }

      const request = await createSampleRequest({
        buyerId,
        supplierId: product.supplier.id,
        productId: product.id,
        address,
        notes: notes.trim() || null,
      })

      dispatchNotification({
        userId: product.supplier.id,
        type: 'sample_requested',
        title: 'New sample request',
        body: `A buyer requested a swatch of ${product.title}.`,
        data: { sample_request_id: request.id },
      }).catch(() => undefined)

      onSubmitted(request.id)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a sample</DialogTitle>
          <DialogDescription>
            A physical swatch of {product.title} posted to you by{' '}
            {product.supplier?.brand_name ?? 'the supplier'}.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.length > 0 && (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Deliver to
                </p>
                {addresses.map((address) => (
                  <button
                    key={address.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(address.id)
                      setAddingNew(false)
                    }}
                    className={cn(
                      'flex w-full items-start gap-3 border p-3 text-left transition-colors',
                      !addingNew && selectedId === address.id
                        ? 'border-accent bg-elevated'
                        : 'border-border hover:border-ink/30',
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-text-primary">
                        {address.recipient_name}
                      </span>
                      <span className="block text-sm text-text-secondary">
                        {formatAddressLine(address)}
                      </span>
                    </span>
                  </button>
                ))}

                {!addingNew && (
                  <button
                    type="button"
                    onClick={() => setAddingNew(true)}
                    className="text-sm text-accent hover:underline"
                  >
                    Use a different address
                  </button>
                )}
              </div>
            )}

            {addingNew && (
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  {addresses.length === 0 ? 'Delivery address' : 'New address'}
                </p>
                <AddressFields
                  values={newAddress}
                  onChange={setNewAddress}
                  disabled={submitting}
                />
                {addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAddingNew(false)}
                    className="text-sm text-accent hover:underline"
                  >
                    Use a saved address instead
                  </button>
                )}
              </div>
            )}

            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Note to supplier (optional)
              </p>
              <Textarea
                rows={3}
                value={notes}
                disabled={submitting}
                placeholder="Anything they should know about what you're looking for."
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || submitting}>
            {submitting ? 'Sending…' : 'Request sample'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SampleRequestDialog
