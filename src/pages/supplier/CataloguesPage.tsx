import { useCallback, useEffect, useState } from 'react'
import { Copy, Link2, Plus, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { getProductImageUrl } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { Tables } from '@/types/database.types'

type Catalogue = Tables<'catalogues'> & { product_count: number }

interface PickerProduct {
  id: string
  title: string
  images: string[]
}

export default function SupplierCataloguesPage() {
  const { profile } = useProfile()
  const supplierId = profile?.id
  const [catalogues, setCatalogues] = useState<Catalogue[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [managing, setManaging] = useState<Catalogue | null>(null)
  const [products, setProducts] = useState<PickerProduct[]>([])
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!supplierId) return
    setLoading(true)
    const { data } = await supabase
      .from('catalogues')
      .select('*, catalogue_products(count)')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
    const rows = (data ?? []).map((c) => {
      const { catalogue_products, ...rest } = c as typeof c & {
        catalogue_products: { count: number }[]
      }
      return { ...rest, product_count: catalogue_products?.[0]?.count ?? 0 } as Catalogue
    })
    setCatalogues(rows)
    setLoading(false)
  }, [supplierId])

  useEffect(() => {
    load()
  }, [load])

  async function createCatalogue() {
    if (!supplierId || !newName.trim()) return
    setCreating(true)
    const { error } = await supabase
      .from('catalogues')
      .insert({ supplier_id: supplierId, name: newName.trim() })
    if (error) toast.error('Could not create catalogue', error.message)
    else {
      setNewName('')
      await load()
    }
    setCreating(false)
  }

  async function toggleActive(catalogue: Catalogue) {
    const { error } = await supabase
      .from('catalogues')
      .update({ is_active: !catalogue.is_active })
      .eq('id', catalogue.id)
    if (error) toast.error('Update failed', error.message)
    else await load()
  }

  async function remove(catalogue: Catalogue) {
    if (!confirm(`Delete "${catalogue.name}"? Anyone with its link will lose access.`)) return
    const { error } = await supabase.from('catalogues').delete().eq('id', catalogue.id)
    if (error) toast.error('Delete failed', error.message)
    else await load()
  }

  function shareUrl(token: string): string {
    return `${window.location.origin}/c/${token}`
  }

  async function copyLink(catalogue: Catalogue) {
    try {
      await navigator.clipboard.writeText(shareUrl(catalogue.share_token))
      setCopiedId(catalogue.id)
      setTimeout(() => setCopiedId((c) => (c === catalogue.id ? null : c)), 1500)
    } catch {
      toast.error('Could not copy link')
    }
  }

  async function openManage(catalogue: Catalogue) {
    setManaging(catalogue)
    const [productsRes, membersRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, title, images')
        .eq('supplier_id', supplierId!)
        .order('title'),
      supabase
        .from('catalogue_products')
        .select('product_id')
        .eq('catalogue_id', catalogue.id),
    ])
    setProducts((productsRes.data ?? []) as PickerProduct[])
    setMemberIds(new Set((membersRes.data ?? []).map((r) => r.product_id)))
  }

  async function toggleMember(productId: string) {
    if (!managing) return
    const isMember = memberIds.has(productId)
    // Optimistic
    setMemberIds((prev) => {
      const next = new Set(prev)
      if (isMember) next.delete(productId)
      else next.add(productId)
      return next
    })
    const { error } = isMember
      ? await supabase
          .from('catalogue_products')
          .delete()
          .eq('catalogue_id', managing.id)
          .eq('product_id', productId)
      : await supabase
          .from('catalogue_products')
          .insert({ catalogue_id: managing.id, product_id: productId })
    if (error) {
      toast.error('Update failed', error.message)
      // Revert
      setMemberIds((prev) => {
        const next = new Set(prev)
        if (isMember) next.add(productId)
        else next.delete(productId)
        return next
      })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Catalogues</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
          Private Catalogues
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Group private fabrics and share them with a buyer by link. Anyone with the link
          can view; revoke it any time.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              New catalogue name
            </label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Spring denim selection"
              className="border-border-cream bg-card-hover text-text-dark"
              onKeyDown={(e) => e.key === 'Enter' && void createCatalogue()}
            />
          </div>
          <Button onClick={() => void createCatalogue()} disabled={creating || !newName.trim()}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : catalogues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-text-dark-secondary">
            No catalogues yet. Create one above to start sharing private fabrics.
          </CardContent>
        </Card>
      ) : (
        catalogues.map((catalogue) => (
          <Card key={catalogue.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-text-dark">{catalogue.name}</CardTitle>
                <p className="mt-1 font-mono text-[11px] text-text-dark-secondary">
                  {catalogue.product_count} fabric{catalogue.product_count === 1 ? '' : 's'} ·{' '}
                  {catalogue.is_active ? 'Active' : 'Revoked'}
                </p>
              </div>
              <span
                className={`font-mono text-[9px] uppercase tracking-widest ${
                  catalogue.is_active ? 'text-success' : 'text-text-muted'
                }`}
              >
                {catalogue.is_active ? '● Live' : '○ Off'}
              </span>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void openManage(catalogue)}>
                <Link2 className="h-4 w-4" />
                Manage fabrics
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copyLink(catalogue)}>
                {copiedId === catalogue.id ? (
                  <>
                    <Check className="h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy link
                  </>
                )}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void toggleActive(catalogue)}>
                {catalogue.is_active ? 'Revoke' : 'Reactivate'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger"
                onClick={() => void remove(catalogue)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={managing !== null} onOpenChange={(open) => !open && setManaging(null)}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{managing?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-text-secondary">
            Tick the fabrics to include in this catalogue.
          </p>
          <ul className="space-y-2">
            {products.map((product) => (
              <li key={product.id}>
                <label className="flex cursor-pointer items-center gap-3 border border-border p-2 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={memberIds.has(product.id)}
                    onChange={() => void toggleMember(product.id)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="h-9 w-9 shrink-0 overflow-hidden bg-elevated">
                    {product.images?.[0] && (
                      <img
                        src={getProductImageUrl(product.images[0], { variant: 'card' })}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="text-sm text-text-primary">{product.title}</span>
                </label>
              </li>
            ))}
            {products.length === 0 && (
              <li className="py-6 text-center text-sm text-text-secondary">
                You have no products to add yet.
              </li>
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  )
}
