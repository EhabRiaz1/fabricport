import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { SupplierWithCount, SupplierWithProfile } from '@/types/app'

async function attachProductCounts(
  suppliers: SupplierWithProfile[],
): Promise<SupplierWithCount[]> {
  const { data: products, error } = await supabase
    .from('products')
    .select('supplier_id')
    .eq('status', 'published')

  if (error) throw new Error(error.message)

  const counts = (products ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.supplier_id] = (acc[row.supplier_id] ?? 0) + 1
    return acc
  }, {})

  return suppliers.map((supplier) => ({
    ...supplier,
    product_count: counts[supplier.id] ?? 0,
  }))
}

export interface UseSuppliersOptions {
  verifiedOnly?: boolean
  limit?: number
  enabled?: boolean
  /** Skip extra query that counts every published product (marketplace filters). */
  skipProductCounts?: boolean
}

export async function fetchSuppliers(
  options: UseSuppliersOptions = {},
): Promise<SupplierWithCount[]> {
  const { verifiedOnly = false, limit, skipProductCounts = false } = options

  let query = supabase
    .from('suppliers')
    .select('*, profile:profiles(*)')
    .order('brand_name', { ascending: true })
  if (verifiedOnly) query = query.eq('is_verified', true)
  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const suppliers = (data ?? []) as SupplierWithProfile[]
  if (skipProductCounts) {
    return suppliers.map((s) => ({ ...s, product_count: 0 }))
  }
  return attachProductCounts(suppliers)
}

export async function fetchSupplierBySlug(
  slug: string,
): Promise<SupplierWithCount | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*, profile:profiles(*)')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  const [withCount] = await attachProductCounts([data as SupplierWithProfile])
  return withCount ?? null
}

export function useSuppliers(options: UseSuppliersOptions = {}) {
  const { verifiedOnly = false, limit, enabled = true, skipProductCounts = false } = options
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await fetchSuppliers({ verifiedOnly, limit, skipProductCounts })
      setSuppliers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers')
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }, [verifiedOnly, limit, skipProductCounts])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    refetch()
  }, [enabled, refetch])

  return { suppliers, loading, error, refetch }
}

export function useSupplier(slug: string | undefined) {
  const [supplier, setSupplier] = useState<SupplierWithCount | null>(null)
  const [loading, setLoading] = useState(Boolean(slug))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) {
      setSupplier(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const supplierSlug = slug

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const data = await fetchSupplierBySlug(supplierSlug)
        if (!cancelled) setSupplier(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load supplier')
          setSupplier(null)
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

  return { supplier, loading, error }
}
