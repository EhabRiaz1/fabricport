import { useCallback, useEffect, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { AdminPageHeader } from '@/pages/admin/components/AdminPageHeader'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from '@/pages/admin/components/AdminTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'
import type { FabricCategory } from '@/types/database.types'

interface Row extends FabricCategory {
  product_count: number
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * Categories are the marketplace's top-level filter (Woven / Knit / Denim), used
 * by FilterSidebar, FilterDock and the product form. They were editable only by
 * direct SQL until now.
 *
 * Deliberately not a taxonomy manager: no nesting, no reordering, no icons. There
 * are three of them and they change about once a year.
 */
export default function AdminCategoriesPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [cats, prods] = await Promise.all([
      supabase.from('fabric_categories').select('*').order('name'),
      supabase.from('products').select('category_id'),
    ])
    const counts = new Map<string, number>()
    for (const p of prods.data ?? []) {
      if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
    }
    setRows(
      ((cats.data ?? []) as FabricCategory[]).map((c) => ({
        ...c,
        product_count: counts.get(c.id) ?? 0,
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create() {
    const name = newName.trim()
    if (!name) return
    setBusy('new')
    const { error } = await supabase
      .from('fabric_categories')
      .insert({ name, slug: slugify(name) })
    setBusy(null)
    if (error) {
      toast.error('Could not add category', error.message)
      return
    }
    setNewName('')
    await load()
    toast.success('Category added')
  }

  async function rename(row: Row) {
    const name = editName.trim()
    if (!name || name === row.name) {
      setEditing(null)
      return
    }
    setBusy(row.id)
    // The slug is part of marketplace URLs, so renaming leaves it alone — a
    // changed slug would silently break any shared /marketplace?category= link.
    const { error } = await supabase.from('fabric_categories').update({ name }).eq('id', row.id)
    setBusy(null)
    if (error) {
      toast.error('Could not rename', error.message)
      return
    }
    setEditing(null)
    await load()
    toast.success('Category renamed')
  }

  async function remove(row: Row) {
    if (row.product_count > 0) {
      toast.error(
        'Category is in use',
        `${row.product_count} product${row.product_count === 1 ? '' : 's'} still use it. Move them first.`,
      )
      return
    }
    setBusy(row.id)
    const { error } = await supabase.from('fabric_categories').delete().eq('id', row.id)
    setBusy(null)
    if (error) {
      toast.error('Could not remove', error.message)
      return
    }
    await load()
    toast.success('Category removed')
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description="The top-level fabric types buyers filter by on the marketplace."
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="min-w-[220px] flex-1">
            <label className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              New category
            </label>
            <Input
              value={newName}
              disabled={busy === 'new'}
              placeholder="e.g. Jersey"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              className="mt-1 border-border-cream bg-card text-text-dark"
            />
          </div>
          <Button onClick={create} disabled={busy === 'new' || !newName.trim()}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-text-dark-secondary">No categories yet.</p>
          </CardContent>
        </Card>
      ) : (
        <AdminTable>
          <AdminTableHead>
            <AdminTableHeaderCell>Name</AdminTableHeaderCell>
            <AdminTableHeaderCell>URL slug</AdminTableHeaderCell>
            <AdminTableHeaderCell>Products</AdminTableHeaderCell>
            <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
          </AdminTableHead>
          <AdminTableBody>
            {rows.map((row) => (
              <AdminTableRow key={row.id}>
                <AdminTableCell className="font-medium">
                  {editing === row.id ? (
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') rename(row)
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      className="h-8 max-w-[220px] border-border-cream bg-card text-text-dark"
                    />
                  ) : (
                    row.name
                  )}
                </AdminTableCell>
                <AdminTableCell className="font-mono text-xs text-text-dark-secondary">
                  {row.slug}
                </AdminTableCell>
                <AdminTableCell>{row.product_count}</AdminTableCell>
                <AdminTableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {editing === row.id ? (
                      <>
                        <Button size="sm" variant="ghost" disabled={busy === row.id} onClick={() => rename(row)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(row.id)
                            setEditName(row.name)
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy === row.id}
                          title={
                            row.product_count > 0
                              ? `${row.product_count} products use this category`
                              : 'Remove'
                          }
                          onClick={() => remove(row)}
                          className={row.product_count > 0 ? 'text-text-muted' : 'text-danger'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </AdminTableCell>
              </AdminTableRow>
            ))}
          </AdminTableBody>
        </AdminTable>
      )}
    </div>
  )
}
