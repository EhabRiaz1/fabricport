import { Navigate, useLocation, useParams } from 'react-router-dom'
import { PublicNav } from '@/components/layout/PublicNav'
import { Footer } from '@/components/layout/Footer'
import { FabricArchive } from '@/components/marketplace/FabricArchive'
import { PageMeta } from '@/components/shared/PageMeta'
import { useAuth } from '@/contexts/AuthContext'
import { buyerDisplayName, usePrivatePortal } from '@/hooks/usePrivatePortal'
import { pluralize } from '@/lib/text'

/**
 * A buyer's private portal: the marketplace archive (same hero, facets, grid and quick
 * view) over the private fabrics suppliers have shared with this buyer. Visibility is
 * enforced by RLS on products, not by anything here; the route sits behind
 * AuthGuard zone="buyer".
 *
 * `/private-portal/:slug` (linked from a private fabric's breadcrumb) is kept as an entry
 * point that preselects that mill: it forwards to `/private-portal?supplier=:slug`, so the
 * supplier lives in the query string like every other facet and clearing it in the panel
 * leaves no stale slug in the path.
 */
export default function PrivatePortalPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const { profile } = useAuth()
  const { suppliers, loading, error } = usePrivatePortal()
  const buyerName = profile ? buyerDisplayName(profile) : ''

  if (slug) {
    const params = new URLSearchParams(location.search)
    params.set('supplier', slug)
    return <Navigate to={`/private-portal?${params.toString()}`} replace />
  }

  const meta = <PageMeta title="Private portal" path="/private-portal" noindex />

  if (!loading && !error && suppliers.length === 0) {
    return (
      <div className="bg-background">
        {meta}
        <PublicNav />
        <main className="mx-auto max-w-7xl px-6 pb-24 pt-28 lg:px-8">
          <div className="mt-12 clip-corner border border-border bg-surface px-8 py-16 text-center">
            <p className="font-display text-lg font-semibold text-text-primary">
              No private fabrics yet
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              When a supplier shares fabrics with you privately, they will appear here.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const millCount = suppliers.length

  return (
    <>
      {meta}
      <FabricArchive
        visibility="private"
        suppliers={suppliers}
        hero={{
          locked: true,
          eyebrow: `${buyerName || 'Your'} · Private Portal`,
          title: 'Private Archive',
          description: loading
            ? `Fabrics mills have made visible only to ${buyerName || 'you'}.`
            : `Fabrics ${pluralize(millCount, 'mill')} ${millCount === 1 ? 'has' : 'have'} made visible only to ${buyerName || 'you'}. Not listed on the public marketplace.`,
          statLabels: { fabrics: 'Private fabrics', mills: 'Mills sharing' },
        }}
      />
    </>
  )
}
