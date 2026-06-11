import { useEffect, useMemo, useState } from 'react'
import { PublicNav } from '@/components/layout/PublicNav'
import { Footer } from '@/components/layout/Footer'
import { AtelierChrome } from '@/components/home/atelier/AtelierChrome'
import { AtelierHero } from '@/components/home/atelier/AtelierHero'
import { MaterialStrip } from '@/components/home/atelier/MaterialStrip'
import { ScanStory } from '@/components/home/atelier/ScanStory'
import { NumbersBand } from '@/components/home/atelier/NumbersBand'
import { ColorRibbon } from '@/components/home/atelier/ColorRibbon'
import { FeaturedGrid } from '@/components/home/atelier/FeaturedGrid'
import { SupplierMarquee } from '@/components/home/atelier/SupplierMarquee'
import { HowItWorks } from '@/components/home/atelier/HowItWorks'
import { FinaleCTA } from '@/components/home/atelier/FinaleCTA'
import { ScrollTrigger } from '@/lib/gsap'
import { supabase } from '@/lib/supabase'
import { usePagePresence } from '@/lib/track'
import { useProducts } from '@/hooks/useProducts'
import { useSuppliers } from '@/hooks/useSuppliers'

export default function HomePage() {
  usePagePresence({ path: '/' })
  const { products } = useProducts({ limit: 14 })
  const { suppliers } = useSuppliers({ verifiedOnly: true, skipProductCounts: true })
  const [totals, setTotals] = useState<{ fabrics: number | null; meters: number | null }>({
    fabrics: null,
    meters: null,
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [countRes, stockRes] = await Promise.all([
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'published'),
        supabase.from('products').select('stock_meters').eq('status', 'published'),
      ])
      if (cancelled) return
      const meters = (stockRes.data ?? []).reduce(
        (sum, row) => sum + Number(row.stock_meters ?? 0),
        0,
      )
      setTotals({ fabrics: countRes.count ?? null, meters: Math.round(meters) })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Pinned sections change layout once data arrives — keep trigger positions honest.
  useEffect(() => {
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 120)
    return () => window.clearTimeout(id)
  }, [products.length, suppliers.length])

  const withImages = useMemo(
    () => products.filter((product) => product.images.length > 0),
    [products],
  )
  const stripProducts = withImages.slice(0, 7)
  const featuredProducts = withImages.slice(7, 12).length >= 5
    ? withImages.slice(7, 12)
    : withImages.slice(0, 5)
  const scanProduct = withImages[2] ?? withImages[0]
  const textureProduct = withImages[1] ?? withImages[0]

  return (
    <div className="bg-background">
      <AtelierChrome />
      <PublicNav />

      <AtelierHero />
      <MaterialStrip products={stripProducts} />
      <ScanStory product={scanProduct} />
      <NumbersBand
        fabrics={totals.fabrics}
        mills={suppliers.length || null}
        metersListed={totals.meters}
      />
      <ColorRibbon />
      <FeaturedGrid products={featuredProducts} />
      <SupplierMarquee suppliers={suppliers} />
      <HowItWorks />
      <FinaleCTA textureProduct={textureProduct} />

      <Footer />
    </div>
  )
}
