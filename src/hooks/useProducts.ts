import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { applyProductFilters } from '@/lib/product-filters'
import type { MarketplaceFilters, ProductWithRelations } from '@/types/app'

const PRODUCT_SELECT = `
  *,
  supplier:suppliers(*),
  category:fabric_categories(*),
  attributes:product_attributes(
    *,
    attribute:fabric_attributes(*)
  )
`

/**
 * Lightweight select for marketplace grid — avoids loading full attribute metadata.
 *
 * The category join is not decoration: "type of fabric" on the card (Knit / Woven / Denim)
 * is the category name. `spec_facets.type` is availability (Stock / Made to Order) and is
 * a different thing entirely.
 */
export const PRODUCT_LIST_SELECT =
  '*, supplier:suppliers(id, brand_name, slug, is_verified), category:fabric_categories(id, name, slug), attributes:product_attributes(value_text, value_number, attribute:fabric_attributes(slug))'

export const MARKETPLACE_PAGE_SIZE = 12

export interface UseProductsOptions {
  filters?: MarketplaceFilters
  featured?: boolean
  supplierSlug?: string
  limit?: number
  enabled?: boolean
  /** Use lighter select + pagination (marketplace grid). */
  paginated?: boolean
  pageSize?: number
}

async function resolveSupplierId(slug: string): Promise<string | null> {
  const { data } = await supabase
    .from('suppliers')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  return data?.id ?? null
}

async function resolveCategoryId(slug: string): Promise<string | null> {
  const { data } = await supabase
    .from('fabric_categories')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  return data?.id ?? null
}

export interface FetchProductsResult {
  products: ProductWithRelations[]
  total: number
}

export async function fetchProducts(
  options: UseProductsOptions = {},
): Promise<ProductWithRelations[]> {
  const result = await fetchProductsPage(options)
  return result.products
}

export async function fetchProductsPage(
  options: UseProductsOptions & { page?: number } = {},
): Promise<FetchProductsResult> {
  const {
    filters,
    featured,
    supplierSlug,
    limit,
    paginated = false,
    pageSize = MARKETPLACE_PAGE_SIZE,
    page = 0,
  } = options

  const from = paginated ? page * pageSize : 0
  const to = paginated
    ? from + pageSize - 1
    : limit
      ? limit - 1
      : undefined

  const supplierSlugToUse = supplierSlug ?? filters?.supplierSlug
  let supplierId: string | null = null
  if (supplierSlugToUse) {
    supplierId = await resolveSupplierId(supplierSlugToUse)
    if (!supplierId) return { products: [], total: 0 }
  }

  let categoryId: string | null = null
  if (filters?.categorySlug) {
    categoryId = await resolveCategoryId(filters.categorySlug)
    if (!categoryId) return { products: [], total: 0 }
  }

  const sort = filters?.sort ?? 'newest'

  if (paginated) {
    let query = supabase
      .from('products')
      .select(PRODUCT_LIST_SELECT, { count: 'exact' })
      .eq('status', 'published')

    if (sort === 'price_asc') {
      query = query.order('price_min_pkr', { ascending: true, nullsFirst: false })
    } else if (sort === 'price_desc') {
      query = query.order('price_min_pkr', { ascending: false, nullsFirst: false })
    } else {
      query = query.order('published_at', { ascending: false })
    }

    if (featured) query = query.eq('is_featured', true)
    if (to !== undefined) query = query.range(from, to)
    query = applyProductFilters(query, filters, { supplierId, categoryId })

    const { data, error, count } = await query
    if (error) throw new Error(error.message)

    const products = (data ?? []) as unknown as ProductWithRelations[]
    return { products, total: count ?? products.length }
  }

  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (featured) query = query.eq('is_featured', true)
  if (limit) query = query.limit(limit)
  query = applyProductFilters(query, filters, { supplierId, categoryId })

  const { data, error, count } = await query
  if (error) throw new Error(error.message)

  const products = (data ?? []) as ProductWithRelations[]
  return { products, total: count ?? products.length }
}

export async function fetchProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as ProductWithRelations | null) ?? null
}

export function useProducts(options: UseProductsOptions = {}) {
  const {
    filters,
    featured,
    supplierSlug,
    limit,
    enabled = true,
    paginated = false,
    pageSize = MARKETPLACE_PAGE_SIZE,
  } = options
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [loading, setLoading] = useState(enabled)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const filterKey = useMemo(() => JSON.stringify(filters ?? {}), [filters])
  const hasMore = paginated && products.length < total

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    setPage(0)

    try {
      if (paginated) {
        const { products: data, total: count } = await fetchProductsPage({
          filters,
          featured,
          supplierSlug,
          paginated: true,
          pageSize,
          page: 0,
        })
        setProducts(data)
        setTotal(count)
      } else {
        const data = await fetchProducts({ filters, featured, supplierSlug, limit })
        setProducts(data)
        setTotal(data.length)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
      setProducts([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filterKey, featured, supplierSlug, limit, paginated, pageSize])

  const loadMore = useCallback(async () => {
    if (!paginated || loadingMore || !hasMore) return

    const nextPage = page + 1
    setLoadingMore(true)
    setError(null)

    try {
      const { products: data, total: count } = await fetchProductsPage({
        filters,
        featured,
        supplierSlug,
        paginated: true,
        pageSize,
        page: nextPage,
      })
      setProducts((prev) => [...prev, ...data])
      setTotal(count)
      setPage(nextPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setLoadingMore(false)
    }
  }, [paginated, loadingMore, hasMore, page, filterKey, featured, supplierSlug, pageSize])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    refetch()
  }, [enabled, refetch])

  return { products, loading, loadingMore, error, refetch, loadMore, hasMore, total }
}

export function useProduct(slug: string | undefined) {
  const [product, setProduct] = useState<ProductWithRelations | null>(null)
  const [loading, setLoading] = useState(Boolean(slug))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setProduct(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const productSlug = slug

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchProductBySlug(productSlug)
        if (!cancelled) setProduct(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load product')
          setProduct(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  return { product, loading, error }
}
