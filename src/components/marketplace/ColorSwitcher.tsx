import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Sibling {
  id: string
  slug: string
  title: string
  color_hex: string | null
  color_display_name: string | null
  color_supplier_name: string | null
  stock_meters: number
}

export interface ColorSwitcherProps {
  fabricGroupId: string | null
  currentProductId: string
  className?: string
  /** How many swatches to show before collapsing into "+N". */
  maxVisible?: number
}

function labelOf(sibling: Sibling): string {
  // `title` last but load-bearing: across the seeded catalog both colour-name
  // columns are null and the product title IS the colourway ("Admiral", "Ash"),
  // so without it every swatch reads "Unnamed colour".
  return sibling.color_display_name ?? sibling.color_supplier_name ?? sibling.title
}

/**
 * Sibling colourways of the same fabric.
 *
 * Seven states, all deliberate:
 *  1. no group          -> renders nothing. The existing single-colour block on
 *                          FabricDetailPage is left completely untouched, which is
 *                          what all 205 seeded products still use.
 *  2. group of one      -> renders nothing. A "switcher" with one option is noise.
 *  3. many              -> wraps, collapsing past `maxVisible` behind "+N".
 *  4. out of stock      -> dimmed and marked, but still navigable: an unavailable
 *                          colourway is information, not a dead end.
 *  5. missing hex       -> checkerboard placeholder rather than a fake grey chip
 *                          that would read as an actual colour.
 *  6. active            -> ring on the current product, not clickable.
 *  7. swap vs route     -> ROUTES to the sibling's own slug. Each colourway is a
 *                          real product with its own price, stock and share URL,
 *                          so an in-place swap would desync the URL from the page.
 */
export function ColorSwitcher({
  fabricGroupId,
  currentProductId,
  className,
  maxVisible = 8,
}: ColorSwitcherProps) {
  const navigate = useNavigate()
  const [siblings, setSiblings] = useState<Sibling[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!fabricGroupId) {
      setSiblings([])
      return
    }
    const groupId = fabricGroupId
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('products')
        .select('id, slug, title, color_hex, color_display_name, color_supplier_name, stock_meters')
        .eq('fabric_group_id', groupId)
        .eq('status', 'published')
        // Ordering on color_display_name would be arbitrary — it is null catalog-wide.
        .order('title', { ascending: true })

      if (!cancelled) setSiblings((data ?? []) as Sibling[])
    }

    load()
    return () => {
      cancelled = true
    }
  }, [fabricGroupId])

  // States 1 and 2.
  if (!fabricGroupId || siblings.length < 2) return null

  const visible = expanded ? siblings : siblings.slice(0, maxVisible)
  const hidden = siblings.length - visible.length

  return (
    <div className={cn('mt-6 border-t border-border-cream pt-5', className)}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
        Also in {siblings.length} colours
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {visible.map((sibling) => {
          const isActive = sibling.id === currentProductId
          const outOfStock = sibling.stock_meters <= 0
          const label = labelOf(sibling)

          return (
            <button
              key={sibling.id}
              type="button"
              disabled={isActive}
              title={outOfStock ? `${label} — out of stock` : label}
              aria-label={label}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => navigate(`/fabric/${sibling.slug}`)}
              className={cn(
                'relative h-9 w-9 border transition-all',
                isActive
                  ? 'cursor-default border-accent ring-2 ring-accent ring-offset-2 ring-offset-card'
                  : 'border-border-cream hover:border-ink/40',
                outOfStock && !isActive && 'opacity-40',
              )}
              style={
                sibling.color_hex
                  ? { backgroundColor: sibling.color_hex }
                  : {
                      // State 5: no hex on record. A checkerboard reads as
                      // "unknown", where a flat grey would read as "this fabric
                      // is grey".
                      backgroundImage:
                        'linear-gradient(45deg,#c8c4bc 25%,transparent 25%,transparent 75%,#c8c4bc 75%),linear-gradient(45deg,#c8c4bc 25%,transparent 25%,transparent 75%,#c8c4bc 75%)',
                      backgroundSize: '8px 8px',
                      backgroundPosition: '0 0, 4px 4px',
                      backgroundColor: '#e8e4dc',
                    }
              }
            >
              {outOfStock && (
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="h-[1px] w-full rotate-45 bg-ink/50" />
                </span>
              )}
            </button>
          )
        })}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="h-9 border border-border-cream px-2 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary transition-colors hover:border-ink/40 hover:text-text-dark"
          >
            +{hidden}
          </button>
        )}
      </div>
    </div>
  )
}

export default ColorSwitcher
