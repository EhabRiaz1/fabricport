import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { buyerDisplayName } from '@/hooks/usePrivatePortal'

interface BuyerOption {
  id: string
  full_name: string | null
  company_name: string | null
  email: string | null
  is_demo?: boolean
}

export interface PrivateBuyerPickerProps {
  value: string[]
  onChange: (buyerIds: string[]) => void
}

/**
 * Chooses which buyer accounts can see a private fabric. Buyers come from the
 * admin-only `get_buyer_directory` RPC, which joins auth.users so the email is
 * shown next to every name: many buyers have no company name, and names repeat.
 */
export function PrivateBuyerPicker({ value, onChange }: PrivateBuyerPickerProps) {
  const [buyers, setBuyers] = useState<BuyerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase.rpc('get_buyer_directory').then(({ data, error: fetchError }) => {
      if (fetchError) setError(fetchError.message)
      const rows = ((data ?? []) as BuyerOption[]).slice()
      rows.sort((a, b) => buyerDisplayName(a).localeCompare(buyerDisplayName(b)))
      setBuyers(rows)
      setLoading(false)
    })
  }, [])

  const selected = useMemo(() => new Set(value), [value])
  const byId = useMemo(() => new Map(buyers.map((b) => [b.id, b])), [buyers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return buyers
    return buyers.filter((b) =>
      [b.company_name, b.full_name, b.email].some((field) => field?.toLowerCase().includes(q)),
    )
  }, [buyers, query])

  function toggle(id: string) {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => {
            const buyer = byId.get(id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 border border-border-cream bg-surface/5 px-2 py-1 text-xs text-text-dark"
              >
                {buyer ? buyerDisplayName(buyer) : 'Loading…'}
                {buyer?.email && (
                  <span className="text-text-dark-secondary">· {buyer.email}</span>
                )}
                <button
                  type="button"
                  aria-label="Remove buyer"
                  onClick={() => toggle(id)}
                  className="text-text-dark-secondary hover:text-accent"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search buyers by company, name or email"
        className="border-border-cream bg-card text-text-dark"
      />

      <div className="max-h-56 overflow-y-auto border border-border-cream" data-lenis-prevent>
        {loading && <p className="px-3 py-2 text-sm text-text-dark-secondary">Loading buyers…</p>}
        {error && <p className="px-3 py-2 text-sm text-danger">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="px-3 py-2 text-sm text-text-dark-secondary">No buyers match.</p>
        )}
        {filtered.map((buyer) => (
          <label
            key={buyer.id}
            className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-text-dark hover:bg-surface/5"
          >
            <input
              type="checkbox"
              checked={selected.has(buyer.id)}
              onChange={() => toggle(buyer.id)}
              className="h-4 w-4 accent-accent"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate">
                {buyerDisplayName(buyer)}
                {buyer.company_name && buyer.full_name && (
                  <span className="text-xs text-text-dark-secondary"> · {buyer.full_name}</span>
                )}
                {buyer.is_demo && (
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-accent">demo</span>
                )}
              </span>
              <span className="truncate text-xs text-text-dark-secondary">{buyer.email ?? '—'}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
