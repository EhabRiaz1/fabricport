import { FabricArchive } from '@/components/marketplace/FabricArchive'
import { PageMeta } from '@/components/shared/PageMeta'
import { useSuppliers } from '@/hooks/useSuppliers'
import { usePagePresence } from '@/lib/track'

/** The public marketplace. The archive body is shared with the buyer's Private Portal. */
export default function MarketplacePage() {
  const { suppliers } = useSuppliers({ verifiedOnly: true, skipProductCounts: true })

  usePagePresence({ path: '/marketplace' })

  return (
    <>
      <PageMeta
        title="Fabric marketplace"
        description="Browse surplus and running fabrics from verified Pakistani mills. Filter by composition, GSM, width, weave and colour, see live stock, and inquire direct."
        path="/marketplace"
      />
      <FabricArchive visibility="public" suppliers={suppliers} />
    </>
  )
}
