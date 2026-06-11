import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/badge'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { getProductImageUrl } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { ProductWithRelations } from '@/types/app'

export default function SupplierInventoryPage() {
  const { profile } = useProfile()
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<
    Record<string, { stock: string; priceMin: string; priceMax: string }>
  >({})
  const [search, setSearch] = useState('')

  const profileId = profile?.id

  const loadProducts = useCallback(async () => {
    if (!profileId) return
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*, category:fabric_categories(*)')
      .eq('supplier_id', profileId)
      .order('updated_at', { ascending: false })

    const list = (data ?? []) as ProductWithRelations[]
    setProducts(list)
    setDrafts(
      Object.fromEntries(
        list.map((p) => [
          p.id,
          {
            stock: String(p.stock_meters),
            priceMin: p.price_min_pkr != null ? String(p.price_min_pkr) : '',
            priceMax: p.price_max_pkr != null ? String(p.price_max_pkr) : '',
          },
        ]),
      ),
    )
    setLoading(false)
  }, [profileId])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  async function saveProduct(productId: string) {
    const draft = drafts[productId]
    if (!draft) return

    setSavingId(productId)

    const { error } = await supabase
      .from('products')
      .update({
        stock_meters: Number(draft.stock) || 0,
        price_min_pkr: draft.priceMin ? Number(draft.priceMin) : null,
        price_max_pkr: draft.priceMax ? Number(draft.priceMax) : null,
        price_approved: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId)

    if (error) {
      toast.error('Update failed', error.message)
    } else {
      toast.success('Product updated', 'Price changes require admin approval.')
      await loadProducts()
    }
    setSavingId(null)
  }

  function updateDraft(
    productId: string,
    field: 'stock' | 'priceMin' | 'priceMax',
    value: string,
  ) {
    setDrafts((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const visibleProducts = search.trim()
    ? products.filter((p) => p.title.toLowerCase().includes(search.trim().toLowerCase()))
    : products

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-accent">Inventory</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">
            Product Catalogue
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            {products.length} fabric{products.length === 1 ? '' : 's'} listed
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            type="search"
            placeholder="Search your fabrics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-surface pl-9 text-text-primary"
          />
        </div>
      </div>

      {visibleProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-text-dark-secondary">
            {products.length === 0
              ? 'No products in your catalogue yet.'
              : 'No fabrics match your search.'}
          </CardContent>
        </Card>
      ) : (
        visibleProducts.map((product) => (
          <Card key={product.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-start gap-4">
                <Link
                  to={`/fabric/${product.slug}`}
                  className="clip-corner-sm block h-14 w-14 shrink-0 overflow-hidden bg-elevated"
                >
                  {product.images?.[0] && (
                    <img
                      src={getProductImageUrl(product.images[0], { variant: 'card' })}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  )}
                </Link>
                <div>
                  <CardTitle className="text-text-dark">{product.title}</CardTitle>
                  <p className="mt-1 text-xs text-text-dark-secondary">
                    {product.category?.name ?? 'Uncategorized'}
                  </p>
                </div>
              </div>
              <StatusBadge status={product.status} />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                    Stock (m)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={drafts[product.id]?.stock ?? ''}
                    onChange={(e) => updateDraft(product.id, 'stock', e.target.value)}
                    className="border-border-cream bg-card-hover text-text-dark"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                    Min Price PKR
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={drafts[product.id]?.priceMin ?? ''}
                    onChange={(e) => updateDraft(product.id, 'priceMin', e.target.value)}
                    className="border-border-cream bg-card-hover text-text-dark"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                    Max Price PKR
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={drafts[product.id]?.priceMax ?? ''}
                    onChange={(e) => updateDraft(product.id, 'priceMax', e.target.value)}
                    className="border-border-cream bg-card-hover text-text-dark"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => saveProduct(product.id)}
                    disabled={savingId === product.id}
                    className="w-full"
                  >
                    {savingId === product.id ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </div>
              {!product.price_approved && product.price_min_pkr != null && (
                <p className="mt-2 text-xs text-warning">Price pending admin approval</p>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
