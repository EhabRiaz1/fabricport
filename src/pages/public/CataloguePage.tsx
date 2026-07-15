import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PackageOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatPrice, getProductImageUrl } from '@/lib/utils'
import { usePreferencesStore } from '@/stores/preferences'
import { BrandLogo } from '@/components/layout/BrandLogo'

interface CatalogueProduct {
  id: string
  title: string
  slug: string
  images: string[]
  gsm: number | null
  width_inches: number | null
  composition: string | null
  price_min_pkr: number | null
  price_max_pkr: number | null
  price_min_usd: number | null
  price_max_usd: number | null
  stock_meters: number
  moq_meters: number | null
  lead_time_days: number | null
  color_hex: string | null
}

interface Catalogue {
  id: string
  name: string
  supplier: { brand_name: string; slug: string; is_verified: boolean }
  products: CatalogueProduct[]
}

function priceLabel(p: CatalogueProduct, currency: 'PKR' | 'USD'): string {
  const min = currency === 'USD' ? p.price_min_usd : p.price_min_pkr
  const max = currency === 'USD' ? p.price_max_usd : p.price_max_pkr
  if (min == null || min === 0) return '—'
  if (max == null || max === min) return formatPrice(min, currency)
  return `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`
}

export default function CataloguePage() {
  const { token } = useParams<{ token: string }>()
  const { currency } = usePreferencesStore()
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) return
      setLoading(true)
      const { data, error } = await supabase.rpc('get_catalogue', { p_token: token })
      if (cancelled) return
      setCatalogue(error || !data ? null : (data as unknown as Catalogue))
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Loading catalogue…
        </span>
      </div>
    )
  }

  if (!catalogue) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <BrandLogo />
        <p className="mt-4 font-display text-2xl font-semibold text-text-primary">
          This catalogue isn't available
        </p>
        <p className="max-w-md text-sm text-text-secondary">
          The link may have been closed by the supplier or has expired. If you were sent
          this by a supplier, please request an updated link.
        </p>
        <Link
          to="/marketplace"
          className="mt-2 font-mono text-[11px] uppercase tracking-widest text-accent hover:underline"
        >
          Browse the public marketplace →
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8">
          <BrandLogo />
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Private catalogue
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent">
          {catalogue.supplier.brand_name}
          {catalogue.supplier.is_verified && <span className="ml-1 text-accent">✓</span>}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-text-primary">
          {catalogue.name}
        </h1>

        {catalogue.products.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center border border-border bg-surface/40 py-16 text-center clip-corner">
            <PackageOpen className="h-8 w-8 text-text-muted" />
            <p className="mt-3 text-sm text-text-secondary">
              This catalogue doesn't have any fabrics yet.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {catalogue.products.map((product) => (
              <article
                key={product.id}
                className="flex flex-col clip-corner clip-corner-accent bg-card text-text-dark"
              >
                <div className="relative aspect-square overflow-hidden bg-[#D8D4CC]">
                  {product.images[0] ? (
                    <img
                      src={getProductImageUrl(product.images[0], { variant: 'card' })}
                      alt={product.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-mono text-[9px] uppercase tracking-widest text-text-dark-secondary/50">
                      No image
                    </div>
                  )}
                  {product.color_hex && (
                    <span
                      className="absolute bottom-2 left-2 h-5 w-5 border border-card shadow-sm"
                      style={{ backgroundColor: product.color_hex }}
                    />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-display text-sm font-semibold leading-tight">
                    {product.title}
                  </h3>
                  <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[10px] text-text-dark-secondary">
                    <div>
                      <dt className="uppercase tracking-widest">GSM</dt>
                      <dd className="mt-0.5 text-text-dark">{product.gsm ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-widest">Width</dt>
                      <dd className="mt-0.5 text-text-dark">
                        {product.width_inches ? `${product.width_inches}"` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-widest">Price</dt>
                      <dd className="mt-0.5 text-text-dark">{priceLabel(product, currency)}</dd>
                    </div>
                    <div>
                      <dt className="uppercase tracking-widest">Stock</dt>
                      <dd className="mt-0.5 text-text-dark">{product.stock_meters.toFixed(0)} m</dd>
                    </div>
                  </dl>
                  {product.composition && (
                    <p className="mt-3 truncate font-mono text-[10px] text-text-dark-secondary">
                      {product.composition}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
