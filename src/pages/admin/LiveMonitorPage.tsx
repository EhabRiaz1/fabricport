import { useEffect, useMemo, useState } from 'react'
import { Activity, Globe, Radio, Users } from 'lucide-react'
import { AdminPageHeader } from '@/pages/admin/components/AdminPageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { subscribePresence, type PresenceEntry } from '@/lib/track'
import { cn } from '@/lib/utils'

const PAGE_LABELS: Record<string, string> = {
  '/': 'Home',
  '/marketplace': 'Marketplace',
}

function pageLabel(path: string): string {
  if (PAGE_LABELS[path]) return PAGE_LABELS[path]
  if (path.startsWith('/fabric/')) return `Fabric · ${path.slice(8)}`
  if (path.startsWith('/supplier/')) return `Catalogue · ${path.slice(10)}`
  return path
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-accent/10 text-accent',
  supplier: 'bg-bronze/15 text-bronze',
  buyer: 'bg-success/10 text-success',
}

export default function LiveMonitorPage() {
  const [entries, setEntries] = useState<PresenceEntry[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribePresence((list) => {
      setConnected(true)
      setEntries(list)
    })
    return unsubscribe
  }, [])

  const byPage = useMemo(() => {
    const map = new Map<string, PresenceEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.path) ?? []
      list.push(entry)
      map.set(entry.path, list)
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [entries])

  const signedIn = entries.filter((e) => e.role).length
  const anonymous = entries.length - signedIn

  return (
    <div>
      <AdminPageHeader
        title="Live Monitor"
        description="Who is on the site right now, page by page — updates in real time."
        actions={
          <div className="flex items-center gap-2 border border-border bg-surface px-4 py-2">
            <span className="relative flex h-2.5 w-2.5">
              {entries.length > 0 && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              )}
              <span
                className={cn(
                  'relative inline-flex h-2.5 w-2.5 rounded-full',
                  connected ? 'bg-success' : 'bg-warning',
                )}
              />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-secondary">
              {connected ? 'Streaming' : 'Connecting…'}
            </span>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Visitors online', value: entries.length, icon: Radio },
          { label: 'Signed in', value: signedIn, icon: Users },
          { label: 'Anonymous', value: anonymous, icon: Globe },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 items-center justify-center bg-accent/10">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
                  {label}
                </p>
                <p className="font-display text-2xl font-semibold text-text-dark">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {byPage.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Activity className="mx-auto h-10 w-10 text-text-muted" />
            <p className="mt-4 text-text-dark-secondary">
              No visitors right now. This view updates the moment someone arrives.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {byPage.map(([path, visitors]) => (
            <Card key={path}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base text-text-dark">{pageLabel(path)}</CardTitle>
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                  {visitors.length} live
                </span>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {visitors.map((visitor) => (
                    <li
                      key={visitor.session}
                      className="flex items-center justify-between gap-3 border border-border-cream bg-card-hover px-3 py-2"
                    >
                      <span className="truncate text-sm text-text-dark">
                        {visitor.company ?? 'Anonymous visitor'}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]',
                          ROLE_STYLES[visitor.role ?? ''] ?? 'bg-elevated text-text-dark-secondary',
                        )}
                      >
                        {visitor.role ?? 'guest'}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
