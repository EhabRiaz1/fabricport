import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'
import type { Tables } from '@/types/database.types'

const NONE = '__none__'

// Mirrors the local helper in ProductFormPage; utils exports no slug function.
function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface FabricGroupPickerProps {
  supplierId: string
  value: string | null
  onChange: (fabricGroupId: string | null) => void
}

/**
 * Assigns a product to a colourway family, and creates families inline so an
 * admin isn't sent to a separate screen mid-edit.
 *
 * Scoped to `supplierId` on purpose: guard_product_fabric_group rejects a product
 * joining another supplier's group, so offering those options would only produce
 * a save-time error.
 */
export function FabricGroupPicker({ supplierId, value, onChange }: FabricGroupPickerProps) {
  const [groups, setGroups] = useState<Tables<'fabric_groups'>[]>([])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!supplierId) {
      setGroups([])
      return
    }
    const { data } = await supabase
      .from('fabric_groups')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('title')
    setGroups((data ?? []) as Tables<'fabric_groups'>[])
  }, [supplierId])

  useEffect(() => {
    load()
  }, [load])

  async function create() {
    const name = title.trim()
    if (!name || !supplierId) return

    setSaving(true)
    const { data, error } = await supabase
      .from('fabric_groups')
      .insert({
        supplier_id: supplierId,
        title: name,
        // slug is globally unique, so scope it with the supplier to avoid two
        // mills colliding on a common fabric name.
        slug: `${slugify(name)}-${supplierId.slice(0, 8)}`,
      })
      .select('*')
      .single()
    setSaving(false)

    if (error) {
      toast.error('Could not create group', error.message)
      return
    }

    setTitle('')
    setCreating(false)
    await load()
    onChange((data as Tables<'fabric_groups'>).id)
    toast.success('Colour family created')
  }

  if (!supplierId) {
    return (
      <div className="space-y-2">
        <Label>Colour family</Label>
        <p className="text-xs text-text-dark-secondary">Pick a supplier first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>Colour family</Label>
      <div className="flex gap-2">
        <Select
          value={value ?? NONE}
          onValueChange={(v) => onChange(v === NONE ? null : v)}
        >
          <SelectTrigger className="border-border-cream bg-card text-text-dark">
            <SelectValue placeholder="Standalone fabric" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Standalone fabric</SelectItem>
            {groups.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCreating((c) => !c)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {creating && (
        <div className="flex gap-2">
          <Input
            value={title}
            disabled={saving}
            placeholder="e.g. Zephyr"
            onChange={(e) => setTitle(e.target.value)}
            className="border-border-cream bg-card text-text-dark"
          />
          <Button type="button" size="sm" onClick={create} disabled={saving || !title.trim()}>
            {saving ? 'Saving…' : 'Create'}
          </Button>
        </div>
      )}

      <p className="text-xs text-text-dark-secondary">
        Products in the same family appear as colour options on each other's pages.
      </p>
    </div>
  )
}

export default FabricGroupPicker
