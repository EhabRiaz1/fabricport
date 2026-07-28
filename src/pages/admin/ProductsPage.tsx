import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Pencil, Plus, Search, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/stores/toast'
import { getProductImageUrl } from '@/lib/product-images'
import { TestReportBadge } from '@/components/shared/TestReportBadge'
import type { ProductWithRelations } from '@/types/app'
import { AdminPageHeader } from './components/AdminPageHeader'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from './components/AdminTable'

const STATUS_FILTERS = ['all', 'published', 'draft'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priceFilter, setPriceFilter] = useState<'all' | 'pending'>('all')
  const { user } = useAuth()

  const loadProducts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('products')
      .select('*, supplier:suppliers(brand_name, slug), category:fabric_categories(name)')
      .order('updated_at', { ascending: false })

    if (!error) setProducts((data ?? []) as ProductWithRelations[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  async function togglePublish(product: ProductWithRelations) {
    setUpdating(product.id)
    const isPublished = product.status === 'published'
    const { error } = await supabase
      .from('products')
      .update({
        status: isPublished ? 'draft' : 'published',
        published_at: isPublished ? null : new Date().toISOString(),
      })
      .eq('id', product.id)

    if (!error) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id
            ? {
                ...p,
                status: isPublished ? 'draft' : 'published',
                published_at: isPublished ? null : new Date().toISOString(),
              }
            : p,
        ),
      )
    }
    setUpdating(null)
  }

  async function toggleFeatured(product: ProductWithRelations) {
    setUpdating(product.id)
    const { error } = await supabase
      .from('products')
      .update({ is_featured: !product.is_featured })
      .eq('id', product.id)

    if (!error) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === product.id ? { ...p, is_featured: !p.is_featured } : p,
        ),
      )
    }
    setUpdating(null)
  }

  /**
   * The one action that could not previously be performed anywhere in the app.
   * The DB has had `price_approved` since day one, the supplier save clears it,
   * the column guard raises 42501 if a non-admin tries to grant it, and the admin
   * dashboard counts "price approvals needed" — but no UI could actually approve,
   * and that dashboard alert linked here, to a page with no approval control.
   */
  async function togglePriceApproved(product: ProductWithRelations) {
    setUpdating(product.id)
    const next = !product.price_approved
    const { error } = await supabase
      .from('products')
      .update({
        price_approved: next,
        price_approved_by: next ? user?.id ?? null : null,
        price_approved_at: next ? new Date().toISOString() : null,
      })
      .eq('id', product.id)
    setUpdating(null)

    if (error) {
      toast.error('Could not update price approval', error.message)
      return
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, price_approved: next } : p)),
    )
    toast.success(next ? 'Price approved' : 'Approval withdrawn')
  }

  /** Cycles approved -> failed -> unset. Admin-only; the DB guard enforces it. */
  async function cycleTestReport(product: ProductWithRelations) {
    const next =
      product.test_report_status === 'approved'
        ? 'failed'
        : product.test_report_status === 'failed'
          ? null
          : 'approved'

    setUpdating(product.id)
    const { error } = await supabase
      .from('products')
      .update({ test_report_status: next })
      .eq('id', product.id)
    setUpdating(null)

    if (error) {
      toast.error('Could not update test report', error.message)
      return
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, test_report_status: next } : p)),
    )
  }

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((product) => {
      if (priceFilter === 'pending' && (product.price_approved || product.price_min_pkr == null))
        return false
      if (statusFilter !== 'all' && product.status !== statusFilter) return false
      if (!q) return true
      return (
        product.title.toLowerCase().includes(q) ||
        product.slug.toLowerCase().includes(q) ||
        (product.supplier?.brand_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [products, search, statusFilter, priceFilter])

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description="Manage catalogue items, publish status, and featured placement."
        actions={
          <Button asChild>
            <Link to="/admin/products/new">
              <Plus className="h-4 w-4" />
              New Product
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            type="search"
            placeholder="Search by name, slug or supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center border border-border">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
                statusFilter === status
                  ? 'bg-ink text-background'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {status}
            </button>
          ))}
        </div>
        {/* The admin dashboard's "Price approvals needed" alert links to this
            page — this is the filter that makes that link actionable. */}
        <button
          type="button"
          onClick={() => setPriceFilter((f) => (f === 'pending' ? 'all' : 'pending'))}
          className={cn(
            'border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors',
            priceFilter === 'pending'
              ? 'border-accent bg-accent text-white'
              : 'border-border text-text-secondary hover:text-text-primary',
          )}
        >
          Pending price approval
        </button>
        {!loading && (
          <p className="ml-auto font-mono text-[10px] uppercase tracking-widest text-text-secondary">
            {visibleProducts.length} of {products.length}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-48 w-full bg-border-cream" />
            </div>
          ) : visibleProducts.length === 0 ? (
            <p className="p-6 text-sm text-text-dark-secondary">
              {products.length === 0 ? 'No products yet.' : 'No products match your search.'}
            </p>
          ) : (
            <AdminTable>
              <AdminTableHead>
                <AdminTableHeaderCell>Product</AdminTableHeaderCell>
                <AdminTableHeaderCell>Supplier</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                <AdminTableHeaderCell>Color</AdminTableHeaderCell>
                <AdminTableHeaderCell>Featured</AdminTableHeaderCell>
                <AdminTableHeaderCell>Price</AdminTableHeaderCell>
                <AdminTableHeaderCell>Test report</AdminTableHeaderCell>
                <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {visibleProducts.map((product) => (
                  <AdminTableRow key={product.id}>
                    <AdminTableCell>
                      <div className="flex items-center gap-3">
                        {product.images?.[0] ? (
                          <img
                            src={getProductImageUrl(product.images[0], { variant: 'card' })}
                            alt=""
                            loading="lazy"
                            className="h-10 w-10 shrink-0 border border-border-cream object-cover"
                          />
                        ) : (
                          <span className="h-10 w-10 shrink-0 border border-dashed border-border-cream" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium">{product.title}</p>
                          <p className="truncate font-mono text-[10px] text-text-dark-secondary">
                            {product.slug}
                          </p>
                        </div>
                      </div>
                    </AdminTableCell>
                    <AdminTableCell>{product.supplier?.brand_name ?? '—'}</AdminTableCell>
                    <AdminTableCell>
                      <StatusBadge status={product.status} />
                    </AdminTableCell>
                    <AdminTableCell>
                      {product.color_hex ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="h-5 w-5 border border-border-cream"
                            style={{ backgroundColor: product.color_hex }}
                          />
                          <span className="text-xs">{product.color_display_name ?? product.color_hex}</span>
                        </div>
                      ) : (
                        <Badge variant="warning">Missing</Badge>
                      )}
                    </AdminTableCell>
                    <AdminTableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={updating === product.id}
                        onClick={() => toggleFeatured(product)}
                        className={product.is_featured ? 'text-accent' : 'text-text-dark-secondary'}
                      >
                        <Star className={`h-4 w-4 ${product.is_featured ? 'fill-current' : ''}`} />
                      </Button>
                    </AdminTableCell>
                    <AdminTableCell>
                      {product.price_min_pkr == null ? (
                        <span className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                          no price
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={updating === product.id}
                          title={
                            product.price_approved
                              ? 'Approved — click to withdraw'
                              : 'Approve this price'
                          }
                          onClick={() => togglePriceApproved(product)}
                          className={
                            product.price_approved ? 'text-success' : 'text-warning'
                          }
                        >
                          <BadgeCheck
                            className={`h-4 w-4 ${product.price_approved ? 'fill-current' : ''}`}
                          />
                          <span className="font-mono text-[10px] uppercase tracking-widest">
                            {product.price_approved ? 'Approved' : 'Pending'}
                          </span>
                        </Button>
                      )}
                    </AdminTableCell>
                    <AdminTableCell>
                      <button
                        type="button"
                        disabled={updating === product.id}
                        onClick={() => cycleTestReport(product)}
                        title="Click to cycle: passed → failed → not tested"
                      >
                        {product.test_report_status ? (
                          <TestReportBadge status={product.test_report_status} compact />
                        ) : (
                          <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                            not tested
                          </span>
                        )}
                      </button>
                    </AdminTableCell>
                    <AdminTableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updating === product.id}
                          onClick={() => togglePublish(product)}
                        >
                          {product.status === 'published' ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/admin/products/${product.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
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
