import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BadgeCheck } from 'lucide-react'
import { PublicNav } from '@/components/layout/PublicNav'
import { Footer } from '@/components/layout/Footer'
import { Skeleton } from '@/components/ui/skeleton'
import { useSuppliers } from '@/hooks/useSuppliers'
import { supabase } from '@/lib/supabase'
import { getProductImageUrl } from '@/lib/utils'

export default function VendorsPage() {
  const { suppliers, loading, error } = useSuppliers({ verifiedOnly: true })
  const [previews, setPreviews] = useState<Record<string, string[]>>({})

  // One query: a pool of recent published images, grouped per supplier.
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('products')
        .select('supplier_id, images')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(400)

      const grouped: Record<string, string[]> = {}
      for (const row of data ?? []) {
        const images = (row.images ?? []) as string[]
        if (!images[0]) continue
        const list = (grouped[row.supplier_id] ??= [])
        if (list.length < 3) {
          list.push(getProductImageUrl(images[0], { variant: 'card' }))
        }
      }
      setPreviews(grouped)
    }
    load()
  }, [])

  return (
    <div className="bg-background">
      <PublicNav />
      <main className="mx-auto max-w-7xl px-6 pb-24 pt-28 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-bronze">
            Supply network
          </p>
          <h1
            className="mt-3 font-display font-bold tracking-tight text-text-primary"
            style={{ fontSize: 'clamp(34px, 5vw, 60px)', lineHeight: 1 }}
          >
            Verified mills
          </h1>
          <p className="mt-5 text-base leading-relaxed text-text-secondary">
            Every supplier on FabricPort is vetted for catalogue quality, response
            reliability, and trade readiness — and every fabric they list passes
            through our scanning studio.
          </p>
        </div>

        {error && (
          <p className="mt-8 text-sm text-danger">Failed to load suppliers: {error}</p>
        )}

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading &&
            Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-72 clip-corner bg-elevated" />
            ))}

          {!loading &&
            suppliers.map((supplier) => {
              const images = previews[supplier.id] ?? []
              return (
                <Link
                  key={supplier.id}
                  to={`/supplier/${supplier.slug}`}
                  className="group clip-corner block border border-ink/10 bg-card transition-all duration-300 hover:-translate-y-1 hover:bg-card-hover hover:shadow-xl hover:shadow-ink/10"
                >
                  {/* Fabric preview strip */}
                  <div className="grid h-40 grid-cols-3 gap-px overflow-hidden bg-elevated">
                    {images.length > 0 ? (
                      images.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt=""
                          loading="lazy"
                          className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ))
                    ) : (
                      <div className="col-span-3 flex items-center justify-center font-mono text-[9px] uppercase tracking-[0.24em] text-text-muted">
                        Catalogue in onboarding
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-3 p-6">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-display text-lg font-semibold tracking-tight text-text-primary group-hover:text-accent">
                          {supplier.brand_name}
                        </h2>
                        {supplier.is_verified && (
                          <BadgeCheck className="h-4 w-4 shrink-0 text-success" />
                        )}
                      </div>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                        {supplier.product_count} fabrics
                        {supplier.badge_label ? ` · ${supplier.badge_label}` : ''}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
                  </div>
                </Link>
              )
            })}
        </div>

        {!loading && suppliers.length === 0 && (
          <div className="mt-12 clip-corner border border-border bg-surface px-8 py-16 text-center">
            <p className="font-display text-lg font-semibold text-text-primary">
              No verified suppliers yet
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Supplier profiles will appear here once onboarding is complete.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
