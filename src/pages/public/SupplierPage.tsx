import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { PublicNav } from '@/components/layout/PublicNav'
import { Footer } from '@/components/layout/Footer'
import { FabricCard } from '@/components/marketplace/FabricCard'
import { UnitToggle } from '@/components/marketplace/UnitToggle'
import { VerifiedBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useProducts } from '@/hooks/useProducts'
import { useSupplier } from '@/hooks/useSuppliers'
import { getFxRate } from '@/lib/fx'
import { trackSupplierView, usePagePresence } from '@/lib/track'
import { usePreferencesStore } from '@/stores/preferences'

export default function SupplierPage() {
  const { slug } = useParams<{ slug: string }>()
  const { supplier, loading: supplierLoading, error } = useSupplier(slug)
  const { products, loading: productsLoading } = useProducts({
    supplierSlug: slug,
    enabled: Boolean(slug),
  })
  const { currency, unit } = usePreferencesStore()
  const [fxRate, setFxRate] = useState(278)

  useEffect(() => {
    getFxRate().then(setFxRate).catch(() => undefined)
  }, [])

  // Catalogue view event + live presence for supplier analytics.
  useEffect(() => {
    if (!supplier?.id) return
    trackSupplierView({ supplierId: supplier.id })
  }, [supplier?.id])

  usePagePresence({
    path: `/supplier/${slug ?? ''}`,
    supplierId: supplier?.id,
  })

  if (supplierLoading) {
    return (
      <>
        <PublicNav />
        <main className="mx-auto max-w-7xl px-6 pb-20 pt-24 lg:px-8">
          <Skeleton className="h-48 w-full clip-corner" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[3/4] clip-corner" />
            ))}
          </div>
        </main>
      </>
    )
  }

  if (error || !supplier) {
    return (
      <>
        <PublicNav />
        <main className="mx-auto max-w-7xl px-6 pb-20 pt-24 text-center lg:px-8">
          <h1 className="font-display text-2xl font-semibold text-text-primary">
            Supplier not found
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {error ?? 'This supplier profile is unavailable.'}
          </p>
          <Button asChild className="mt-6">
            <Link to="/vendors">Browse vendors</Link>
          </Button>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <PublicNav />
      <main className="mx-auto max-w-7xl px-6 pb-20 pt-24 lg:px-8">
        <section className="clip-corner border border-border bg-surface p-8 lg:p-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
                  {supplier.brand_name}
                </h1>
                {supplier.is_verified && <VerifiedBadge />}
              </div>

              {supplier.badge_label && (
                <p className="mt-2 text-sm text-text-secondary">{supplier.badge_label}</p>
              )}

              <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                {supplier.product_count} published fabrics
              </p>

              <div className="mt-6 flex flex-wrap gap-4">
                {supplier.website_url && (
                  <a
                    href={supplier.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                  </a>
                )}
                {supplier.instagram_url && (
                  <a
                    href={supplier.instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-accent"
                  >
                    <Globe className="h-4 w-4" />
                    Instagram
                  </a>
                )}
              </div>
            </div>

            <UnitToggle />
          </div>
        </section>

        <div className="mt-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
            Catalogue
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {productsLoading ? 'Loading products…' : `${products.length} fabrics from this supplier`}
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {productsLoading &&
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[3/4] clip-corner" />
              ))}

            {!productsLoading &&
              products.map((product) => (
                <FabricCard
                  key={product.id}
                  product={product}
                  variant="grid"
                  currency={currency}
                  unit={unit}
                  fxRate={fxRate}
                />
              ))}
          </div>

          {!productsLoading && products.length === 0 && (
            <div className="clip-corner border border-border bg-surface px-8 py-16 text-center">
              <p className="font-display text-lg font-semibold text-text-primary">
                No published fabrics yet
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                Check back soon for new inventory from {supplier.brand_name}.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
