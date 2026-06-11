import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import type { FabricAttribute, FabricAttributeType, FabricCategory } from '@/types/database.types'
import { AdminPageHeader } from './components/AdminPageHeader'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from './components/AdminTable'

const ATTRIBUTE_TYPES: FabricAttributeType[] = [
  'text',
  'number',
  'select',
  'multiselect',
  'boolean',
  'range',
]

interface AttributeForm {
  name: string
  slug: string
  type: FabricAttributeType
  unit: string
  category_id: string
  is_required: boolean
  is_filterable: boolean
  display_order: string
}

const EMPTY_FORM: AttributeForm = {
  name: '',
  slug: '',
  type: 'text',
  unit: '',
  category_id: '',
  is_required: false,
  is_filterable: true,
  display_order: '0',
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function AttributesPage() {
  const [attributes, setAttributes] = useState<FabricAttribute[]>([])
  const [categories, setCategories] = useState<FabricCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<AttributeForm>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [attrsRes, catsRes] = await Promise.all([
      supabase.from('fabric_attributes').select('*').order('display_order'),
      supabase.from('fabric_categories').select('*').order('name'),
    ])
    setAttributes(attrsRes.data ?? [])
    setCategories(catsRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  function startCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function startEdit(attr: FabricAttribute) {
    setEditingId(attr.id)
    setForm({
      name: attr.name,
      slug: attr.slug,
      type: attr.type,
      unit: attr.unit ?? '',
      category_id: attr.category_id ?? '',
      is_required: attr.is_required,
      is_filterable: attr.is_filterable,
      display_order: String(attr.display_order),
    })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.slug.trim()) return

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      type: form.type,
      unit: form.unit.trim() || null,
      category_id: form.category_id || null,
      is_required: form.is_required,
      is_filterable: form.is_filterable,
      display_order: Number(form.display_order) || 0,
    }

    if (editingId) {
      await supabase.from('fabric_attributes').update(payload).eq('id', editingId)
    } else {
      await supabase.from('fabric_attributes').insert(payload)
    }

    setSaving(false)
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this attribute?')) return
    await supabase.from('fabric_attributes').delete().eq('id', id)
    loadData()
  }

  return (
    <div>
      <AdminPageHeader
        title="Fabric Attributes"
        description="Manage EAV attribute definitions for product specifications."
        actions={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" />
            Add Attribute
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="attr-name">Name</Label>
                <Input
                  id="attr-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: e.target.value,
                      slug: editingId ? f.slug : slugify(e.target.value),
                    }))
                  }
                  className="border-border-cream bg-card text-text-dark"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attr-slug">Slug</Label>
                <Input
                  id="attr-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="border-border-cream bg-card font-mono text-text-dark"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as FabricAttributeType }))
                  }
                >
                  <SelectTrigger className="border-border-cream bg-card text-text-dark">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTRIBUTE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="attr-unit">Unit</Label>
                <Input
                  id="attr-unit"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="e.g. GSM"
                  className="border-border-cream bg-card text-text-dark"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category_id || 'global'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category_id: v === 'global' ? '' : v }))
                  }
                >
                  <SelectTrigger className="border-border-cream bg-card text-text-dark">
                    <SelectValue placeholder="Global" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global (all categories)</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="attr-order">Display Order</Label>
                <Input
                  id="attr-order"
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm((f) => ({ ...f, display_order: e.target.value }))}
                  className="border-border-cream bg-card text-text-dark"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-text-dark">
                <input
                  type="checkbox"
                  checked={form.is_required}
                  onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked }))}
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm text-text-dark">
                <input
                  type="checkbox"
                  checked={form.is_filterable}
                  onChange={(e) => setForm((f) => ({ ...f, is_filterable: e.target.checked }))}
                />
                Filterable
              </label>
            </div>
            <div className="flex gap-2">
              <Button disabled={saving} onClick={handleSave}>
                {editingId ? 'Update' : 'Create'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-48 w-full bg-border-cream" />
            </div>
          ) : attributes.length === 0 ? (
            <p className="p-6 text-sm text-text-dark-secondary">No attributes defined.</p>
          ) : (
            <AdminTable>
              <AdminTableHead>
                <AdminTableHeaderCell>Name</AdminTableHeaderCell>
                <AdminTableHeaderCell>Slug</AdminTableHeaderCell>
                <AdminTableHeaderCell>Type</AdminTableHeaderCell>
                <AdminTableHeaderCell>Unit</AdminTableHeaderCell>
                <AdminTableHeaderCell>Flags</AdminTableHeaderCell>
                <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {attributes.map((attr) => (
                  <AdminTableRow key={attr.id}>
                    <AdminTableCell className="font-medium">{attr.name}</AdminTableCell>
                    <AdminTableCell className="font-mono text-xs">{attr.slug}</AdminTableCell>
                    <AdminTableCell>{attr.type}</AdminTableCell>
                    <AdminTableCell>{attr.unit ?? '—'}</AdminTableCell>
                    <AdminTableCell className="text-xs text-text-dark-secondary">
                      {attr.is_required && 'required '}
                      {attr.is_filterable && 'filterable'}
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(attr)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(attr.id)}>
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    </AdminTableCell>
                  </AdminTableRow>
                ))}
              </AdminTableBody>
            </AdminTable>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
