import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, BadgeCheck, Lock } from 'lucide-react'
import { PublicNav } from '@/components/layout/PublicNav'
import { Footer } from '@/components/layout/Footer'
import { FabricCard } from '@/components/marketplace/FabricCard'
import { UnitToggle } from '@/components/marketplace/UnitToggle'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/contexts/AuthContext'
import { useProducts } from '@/hooks/useProducts'
import { buyerDisplayName, usePrivatePortal } from '@/hooks/usePrivatePortal'
import { getFxRate } from '@/lib/fx'
import { usePreferencesStore } from '@/stores/preferences'

/**
 * A buyer's private portal: `/private-portal` lists the suppliers who have shared
 * private fabrics with them; `/private-portal/:slug` lists that supplier's shared fabrics.
 * Visibility is enforced by RLS on products, not by anything here.
 */
export default function PrivatePortalPage() {
  const { slug } = useParams<{ slug: string }>()
  const { profile } = useAuth()
  const { suppliers, loading, error } = usePrivatePortal()
  const supplier = slug ? suppliers.find((s) => s.slug === slug) : undefined
  const buyerName = profile ? buyerDisplayName(profile) : ''

  return (
    <div className="bg-background">
      <PublicNav />
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-28 lg:px-8">
        <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">
          <Lock className="h-3 w-3" />
          {buyerName} · Private Portal
        </p>

        {error && <p className="mt-8 text-sm text-danger">Failed to load: {error}</p>}

        {slug ? (
          <SupplierFabrics
            slug={slug}
            brandName={supplier?.brand_name}
            unknown={!loading && !supplier}
          />
        ) : (
          <>
            <h1
              className="mt-3 font-display font-bold tracking-tight text-text-primary"
              style={{ fontSize: 'clamp(34px, 5vw, 60px)', lineHeight: 1 }}
            >
              Your suppliers
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-secondary">
              Fabrics these suppliers have made visible only to {buyerName || 'you'}.
            </p>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {loading &&
                Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-72 clip-corner bg-elevated" />
                ))}

              {!loading &&
                suppliers.map((s) => (
                  <Link
                    key={s.id}
                    to={`/private-portal/${s.slug}`}
                    className="group clip-corner block border border-ink/10 bg-card transition-all duration-300 hover:-translate-y-1 hover:bg-card-hover hover:shadow-xl hover:shadow-ink/10"
                  >
                    <div className="grid h-40 grid-cols-3 gap-px overflow-hidden bg-elevated">
                      {s.previews.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt=""
                          loading="lazy"
                          className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ))}
                    </div>
                    <div className="flex items-start justify-between gap-3 p-6">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate font-display text-lg font-semibold tracking-tight text-text-primary group-hover:text-accent">
                            {s.brand_name}
                          </h2>
                          {s.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-success" />}
                        </div>
                        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                          {s.product_count} private {s.product_count === 1 ? 'fabric' : 'fabrics'}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                    </div>
                  </Link>
                ))}
            </div>

            {!loading && !error && suppliers.length === 0 && (
              <div className="mt-12 clip-corner border border-border bg-surface px-8 py-16 text-center">
                <p className="font-display text-lg font-semibold text-text-primary">
                  No private fabrics yet
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  When a supplier shares fabrics with you privately, they will appear here.
                </p>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

function SupplierFabrics({
  slug,
  brandName,
  unknown,
}: {
  slug: string
  brandName: string | undefined
  unknown: boolean
}) {
  const { products, loading } = useProducts({ supplierSlug: slug, visibility: 'private' })
  const { currency, unit } = usePreferencesStore()
  const [fxRate, setFxRate] = useState(278)

  useEffect(() => {
    getFxRate().then(setFxRate).catch(() => undefined)
  }, [])

  return (
    <>
      <Link
        to="/private-portal"
        className="mt-6 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted hover:text-accent"
      >
        <ArrowLeft className="h-3 w-3" />
        All suppliers
      </Link>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="font-display font-bold tracking-tight text-text-primary"
            style={{ fontSize: 'clamp(30px, 4vw, 48px)', lineHeight: 1 }}
          >
            {brandName ?? (unknown ? 'Supplier not found' : ' ')}
          </h1>
          <p className="mt-3 text-sm text-text-secondary">
            {loading ? 'Loading fabrics…' : `${products.length} private fabrics`}
          </p>
        </div>
        <UnitToggle />
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {loading &&
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[3/4] clip-corner" />
          ))}

        {!loading &&
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

      {!loading && products.length === 0 && (
        <div className="clip-corner border border-border bg-surface px-8 py-16 text-center">
          <p className="font-display text-lg font-semibold text-text-primary">
            No private fabrics from this supplier
          </p>
        </div>
      )}
    </>
  )
}
