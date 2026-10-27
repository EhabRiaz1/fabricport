import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
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
import { toast } from '@/stores/toast'
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
  options: string[]
}

const HAS_OPTIONS = (t: FabricAttributeType) => t === 'select' || t === 'multiselect'

function readOptions(options: unknown): string[] {
  return Array.isArray(options)
    ? options.filter((o): o is string => typeof o === 'string' && o.trim() !== '')
    : []
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
  options: [],
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
  const [formError, setFormError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newOption, setNewOption] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [attrsRes, catsRes] = await Promise.all([
      supabase.from('fabric_attributes').select('*').order('display_order'),
      supabase.from('fabric_categories').select('*').order('name'),
    ])
    setLoadError(attrsRes.error?.message ?? catsRes.error?.message ?? null)
    setAttributes(attrsRes.data ?? [])
    setCategories(catsRes.data ?? [])
    setLoading(false)
  }, [])

  function addOption() {
    const opt = newOption.trim()
    if (!opt) return
    if (form.options.some((o) => o.toLowerCase() === opt.toLowerCase())) {
      setFormError(`"${opt}" is already an option.`)
      return
    }
    setForm((f) => ({ ...f, options: [...f.options, opt] }))
    setNewOption('')
    setFormError(null)
  }

  function moveOption(index: number, delta: -1 | 1) {
    setForm((f) => {
      const next = [...f.options]
      const j = index + delta
      if (j < 0 || j >= next.length) return f
      ;[next[index], next[j]] = [next[j], next[index]]
      return { ...f, options: next }
    })
  }

  useEffect(() => {
    loadData()
  }, [loadData])

  function startCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setNewOption('')
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
      options: readOptions(attr.options),
    })
    setFormError(null)
    setNewOption('')
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.slug.trim()) {
      setFormError('Name and slug are required.')
      return
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug.trim())) {
      setFormError('Slug may only contain lowercase letters, numbers and single dashes.')
      return
    }
    if (HAS_OPTIONS(form.type) && form.options.length === 0) {
      setFormError('Add at least one option for a select or multiselect attribute.')
      return
    }
    setFormError(null)

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
      // Options only mean something for select/multiselect; other types keep theirs
      // untouched so switching type back and forth does not lose the list.
      ...(HAS_OPTIONS(form.type) ? { options: form.options } : {}),
    }

    const { error } = editingId
      ? await supabase.from('fabric_attributes').update(payload).eq('id', editingId)
      : await supabase.from('fabric_attributes').insert(payload)

    setSaving(false)
    if (error) {
      const msg =
        error.code === '23505' ? `An attribute with the slug "${payload.slug}" already exists.` : error.message
      setFormError(msg)
      toast.error('Could not save attribute', msg)
      return
    }
    toast.success(editingId ? 'Attribute updated' : 'Attribute created')
    setShowForm(false)
    setForm(EMPTY_FORM)
    setEditingId(null)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this attribute? Values stored on products for it are removed too.')) return
    const { error } = await supabase.from('fabric_attributes').delete().eq('id', id)
    if (error) {
      toast.error('Could not delete attribute', error.message)
      return
    }
    toast.success('Attribute deleted')
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
            {HAS_OPTIONS(form.type) && (
              <div className="space-y-2">
                <Label htmlFor="attr-new-option">Options</Label>
                {form.options.length === 0 ? (
                  <p className="text-xs text-text-dark-secondary">
                    No options yet. Products will show a dropdown with these values.
                  </p>
                ) : (
                  <ol className="divide-y divide-border-cream border border-border-cream">
                    {form.options.map((opt, i) => (
                      <li key={opt} className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-dark">
                        <span className="flex-1">{opt}</span>
                        <button
                          type="button"
                          className="px-1 text-xs text-text-dark-secondary hover:text-text-dark disabled:opacity-30"
                          onClick={() => moveOption(i, -1)}
                          disabled={i === 0}
                          aria-label={`Move ${opt} up`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="px-1 text-xs text-text-dark-secondary hover:text-text-dark disabled:opacity-30"
                          onClick={() => moveOption(i, 1)}
                          disabled={i === form.options.length - 1}
                          aria-label={`Move ${opt} down`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="text-text-dark-secondary hover:text-danger"
                          onClick={() =>
                            setForm((f) => ({ ...f, options: f.options.filter((o) => o !== opt) }))
                          }
                          aria-label={`Remove ${opt}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="flex max-w-md gap-2">
                  <Input
                    id="attr-new-option"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addOption()
                      }
                    }}
                    placeholder="Add an option"
                    maxLength={80}
                    className="border-border-cream bg-card text-text-dark"
                  />
                  <Button type="button" variant="outline" onClick={addOption}>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>
            )}
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
            {formError && (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            )}
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
          ) : loadError ? (
            <p role="alert" className="p-6 text-sm text-danger">
              Could not load attributes: {loadError}
            </p>
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
                    <AdminTableCell>
                      {attr.type}
                      {HAS_OPTIONS(attr.type) && (
                        <span className="block max-w-[220px] truncate text-xs text-text-dark-secondary">
                          {readOptions(attr.options).join(', ') || 'no options'}
                        </span>
                      )}
                    </AdminTableCell>
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
