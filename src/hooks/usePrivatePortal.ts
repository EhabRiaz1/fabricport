import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getProductImageUrl } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

export interface PrivatePortalSupplier {
  id: string
  brand_name: string
  slug: string
  is_verified: boolean
  product_count: number
  previews: string[]
}

/** Company name first: that is what admins and buyers recognise (e.g. "DKC"). */
export function buyerDisplayName(buyer: {
  full_name: string | null
  company_name: string | null
}): string {
  return buyer.company_name?.trim() || buyer.full_name?.trim() || 'Unnamed buyer'
}

interface PrivateProductRow {
  images: string[] | null
  supplier: { id: string; brand_name: string; slug: string; is_verified: boolean } | null
}

/**
 * Suppliers with private fabrics shared with the signed-in buyer. RLS on `products`
 * returns only the private rows listed for this buyer in product_private_buyers,
 * so no buyer filter is needed here. Anyone who isn't a buyer gets an empty list
 * without querying (admins can read every private row and would otherwise see a portal).
 */
export function usePrivatePortal() {
  const { user, role } = useAuth()
  const isBuyer = role === 'buyer' && Boolean(user)
  const [suppliers, setSuppliers] = useState<PrivatePortalSupplier[]>([])
  const [loading, setLoading] = useState(isBuyer)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isBuyer) {
      setSuppliers([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    supabase
      .from('products')
      .select('images, supplier:suppliers(id, brand_name, slug, is_verified)')
      .eq('status', 'published')
      .eq('visibility', 'private')
      .order('published_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return
        if (fetchError) {
          setError(fetchError.message)
          setSuppliers([])
          setLoading(false)
          return
        }

        const bySupplier = new Map<string, PrivatePortalSupplier>()
        for (const row of (data ?? []) as unknown as PrivateProductRow[]) {
          if (!row.supplier) continue
          const entry =
            bySupplier.get(row.supplier.id) ??
            bySupplier
              .set(row.supplier.id, { ...row.supplier, product_count: 0, previews: [] })
              .get(row.supplier.id)!
          entry.product_count += 1
          const image = row.images?.[0]
          if (image && entry.previews.length < 3) {
            entry.previews.push(getProductImageUrl(image, { variant: 'card' }))
          }
        }

        setSuppliers(
          [...bySupplier.values()].sort((a, b) => a.brand_name.localeCompare(b.brand_name)),
        )
        setError(null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isBuyer, user?.id])

  return { suppliers, loading, error, hasAccess: suppliers.length > 0 }
}
