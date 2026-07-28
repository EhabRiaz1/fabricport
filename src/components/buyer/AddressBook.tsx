import { useCallback, useEffect, useState } from 'react'
import { MapPin, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/utils'
import type { ShippingAddress } from '@/types/database.types'

export interface AddressFormValues {
  label: string
  recipient_name: string
  phone: string
  line1: string
  line2: string
  city: string
  province: string
  postal_code: string
  country: string
}

export const EMPTY_ADDRESS: AddressFormValues = {
  label: '',
  recipient_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  province: '',
  postal_code: '',
  country: 'PK',
}

export async function fetchAddresses(buyerId: string): Promise<ShippingAddress[]> {
  const { data, error } = await supabase
    .from('shipping_addresses')
    .select('*')
    .eq('buyer_id', buyerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ShippingAddress[]
}

export async function insertAddress(
  buyerId: string,
  values: AddressFormValues,
  makeDefault: boolean,
): Promise<ShippingAddress> {
  // uq_shipping_addresses_one_default is a partial unique index, so an existing
  // default must be cleared first or the insert violates it.
  if (makeDefault) {
    await supabase
      .from('shipping_addresses')
      .update({ is_default: false })
      .eq('buyer_id', buyerId)
      .eq('is_default', true)
  }

  const { data, error } = await supabase
    .from('shipping_addresses')
    .insert({
      buyer_id: buyerId,
      label: values.label || null,
      recipient_name: values.recipient_name,
      phone: values.phone || null,
      line1: values.line1,
      line2: values.line2 || null,
      city: values.city,
      province: values.province || null,
      postal_code: values.postal_code || null,
      country: values.country || 'PK',
      is_default: makeDefault,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as ShippingAddress
}

/** The shared form body, so the Settings card and the sample dialog stay identical. */
export function AddressFields({
  values,
  onChange,
  disabled,
}: {
  values: AddressFormValues
  onChange: (next: AddressFormValues) => void
  disabled?: boolean
}) {
  function set<K extends keyof AddressFormValues>(key: K, value: string) {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input
        placeholder="Recipient name *"
        value={values.recipient_name}
        disabled={disabled}
        onChange={(e) => set('recipient_name', e.target.value)}
      />
      <Input
        placeholder="Phone"
        value={values.phone}
        disabled={disabled}
        onChange={(e) => set('phone', e.target.value)}
      />
      <Input
        className="sm:col-span-2"
        placeholder="Address line 1 *"
        value={values.line1}
        disabled={disabled}
        onChange={(e) => set('line1', e.target.value)}
      />
      <Input
        className="sm:col-span-2"
        placeholder="Address line 2"
        value={values.line2}
        disabled={disabled}
        onChange={(e) => set('line2', e.target.value)}
      />
      <Input
        placeholder="City *"
        value={values.city}
        disabled={disabled}
        onChange={(e) => set('city', e.target.value)}
      />
      <Input
        placeholder="Province"
        value={values.province}
        disabled={disabled}
        onChange={(e) => set('province', e.target.value)}
      />
      <Input
        placeholder="Postal code"
        value={values.postal_code}
        disabled={disabled}
        onChange={(e) => set('postal_code', e.target.value)}
      />
      <Input
        placeholder="Country"
        value={values.country}
        disabled={disabled}
        onChange={(e) => set('country', e.target.value)}
      />
      <Input
        className="sm:col-span-2"
        placeholder="Label (e.g. Head office)"
        value={values.label}
        disabled={disabled}
        onChange={(e) => set('label', e.target.value)}
      />
    </div>
  )
}

export function isAddressComplete(values: AddressFormValues): boolean {
  return Boolean(values.recipient_name.trim() && values.line1.trim() && values.city.trim())
}

export function formatAddressLine(address: ShippingAddress): string {
  return [address.line1, address.line2, address.city, address.province, address.postal_code]
    .filter(Boolean)
    .join(', ')
}

/**
 * Lives inside buyer Settings rather than as its own nav item — an address book
 * is account configuration, not a destination, and the buyer nav is already
 * carrying Shop/Orders/Account.
 */
export function AddressBook({ buyerId, className }: { buyerId: string; className?: string }) {
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<AddressFormValues>(EMPTY_ADDRESS)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAddresses(await fetchAddresses(buyerId))
    } catch (err) {
      toast.error('Could not load addresses', err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }, [buyerId])

  useEffect(() => {
    load()
  }, [load])

  async function handleSave() {
    if (!isAddressComplete(values)) return
    setSaving(true)
    try {
      await insertAddress(buyerId, values, addresses.length === 0)
      setValues(EMPTY_ADDRESS)
      setAdding(false)
      await load()
      toast.success('Address saved')
    } catch (err) {
      toast.error('Could not save address', err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  async function makeDefault(id: string) {
    await supabase
      .from('shipping_addresses')
      .update({ is_default: false })
      .eq('buyer_id', buyerId)
      .eq('is_default', true)
    const { error } = await supabase
      .from('shipping_addresses')
      .update({ is_default: true })
      .eq('id', id)
    if (error) {
      toast.error('Could not set default', error.message)
      return
    }
    await load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('shipping_addresses').delete().eq('id', id)
    if (error) {
      toast.error('Could not remove address', error.message)
      return
    }
    await load()
  }

  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-text-dark">Shipping Addresses</CardTitle>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-dark-secondary">
          Used when you request a fabric sample. Suppliers only ever see the address on the
          request you send them.
        </p>

        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : addresses.length === 0 && !adding ? (
          <p className="py-4 text-center text-sm text-text-dark-secondary">
            No addresses saved yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {addresses.map((address) => (
              <li
                key={address.id}
                className={cn(
                  'flex items-start gap-3 border border-border-cream p-3',
                  address.is_default && 'border-accent/40 bg-card-hover',
                )}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-dark-secondary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-dark">
                    {address.recipient_name}
                    {address.label && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                        {address.label}
                      </span>
                    )}
                    {address.is_default && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-accent">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-text-dark-secondary">
                    {formatAddressLine(address)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!address.is_default && (
                    <button
                      type="button"
                      title="Make default"
                      onClick={() => makeDefault(address.id)}
                      className="p-1.5 text-text-dark-secondary transition-colors hover:text-accent"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => remove(address.id)}
                    className="p-1.5 text-text-dark-secondary transition-colors hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {adding && (
          <div className="space-y-3 border-t border-border-cream pt-4">
            <AddressFields values={values} onChange={setValues} disabled={saving} />
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !isAddressComplete(values)}>
                {saving ? 'Saving…' : 'Save address'}
              </Button>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setAdding(false)
                  setValues(EMPTY_ADDRESS)
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AddressBook
