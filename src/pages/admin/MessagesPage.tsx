import { useCallback, useEffect, useMemo, useState } from 'react'
import { LifeBuoy, MessageSquare, PenSquare, Search } from 'lucide-react'
import { ChatThread } from '@/components/chat/ChatThread'
import { SupportThread } from '@/components/chat/SupportThread'
import { AdminPageHeader } from '@/pages/admin/components/AdminPageHeader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { InquiryStatusBadge } from '@/components/shared/InquiryStatusBadge'
import { useProfile } from '@/hooks/useProfile'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { InquiryStatus, Profile } from '@/types/database.types'

type Tab = 'inquiries' | 'support'

interface InquiryConversation {
  id: string
  status: InquiryStatus
  updated_at: string
  buyerName: string
  supplierName: string
  lastMessage: string | null
  lastMessageAt: string | null
  messageCount: number
}

interface SupportConversation {
  userId: string
  name: string
  role: string
  lastMessage: string
  lastMessageAt: string
  unreadFromUser: number
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export default function AdminMessagesPage() {
  const { profile } = useProfile()
  const [tab, setTab] = useState<Tab>('inquiries')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [inquiryConvos, setInquiryConvos] = useState<InquiryConversation[]>([])
  const [supportConvos, setSupportConvos] = useState<SupportConversation[]>([])
  const [selectedInquiry, setSelectedInquiry] = useState<string | null>(null)
  const [selectedSupportUser, setSelectedSupportUser] = useState<string | null>(null)

  // Compose dialog
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeSearch, setComposeSearch] = useState('')
  const [allUsers, setAllUsers] = useState<Profile[]>([])

  const load = useCallback(async () => {
    setLoading(true)

    const [inquiriesRes, messagesRes, supportRes] = await Promise.all([
      supabase
        .from('inquiries')
        .select(
          `id, status, updated_at,
           buyer:buyers(id, profile:profiles(full_name, company_name)),
           supplier:suppliers(brand_name)`,
        )
        .order('updated_at', { ascending: false })
        .limit(60),
      supabase
        .from('messages')
        .select('inquiry_id, content, created_at')
        .order('created_at', { ascending: false })
        .limit(400),
      supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(400),
    ])

    // Build inquiry conversations with last-message previews.
    const msgByInquiry = new Map<string, { content: string | null; at: string; count: number }>()
    for (const msg of messagesRes.data ?? []) {
      const existing = msgByInquiry.get(msg.inquiry_id)
      if (existing) {
        existing.count++
      } else {
        msgByInquiry.set(msg.inquiry_id, {
          content: msg.content,
          at: msg.created_at,
          count: 1,
        })
      }
    }

    setInquiryConvos(
      (inquiriesRes.data ?? []).map((row) => {
        const r = row as unknown as {
          id: string
          status: InquiryStatus
          updated_at: string
          buyer: { profile: { full_name: string | null; company_name: string | null } | null } | null
          supplier: { brand_name: string } | null
        }
        const msg = msgByInquiry.get(r.id)
        return {
          id: r.id,
          status: r.status,
          updated_at: r.updated_at,
          buyerName:
            r.buyer?.profile?.company_name ?? r.buyer?.profile?.full_name ?? 'Buyer',
          supplierName: r.supplier?.brand_name ?? 'Supplier',
          lastMessage: msg?.content ?? null,
          lastMessageAt: msg?.at ?? null,
          messageCount: msg?.count ?? 0,
        }
      }),
    )

    // Build support conversations grouped by user.
    const byUser = new Map<string, SupportConversation>()
    const userIds = new Set<string>()
    for (const msg of supportRes.data ?? []) {
      userIds.add(msg.user_id)
      const existing = byUser.get(msg.user_id)
      if (!existing) {
        byUser.set(msg.user_id, {
          userId: msg.user_id,
          name: '',
          role: '',
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          unreadFromUser: msg.sender_id === msg.user_id && !msg.read_at ? 1 : 0,
        })
      } else if (msg.sender_id === msg.user_id && !msg.read_at) {
        existing.unreadFromUser++
      }
    }

    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, role')
        .in('id', Array.from(userIds))
      for (const p of profiles ?? []) {
        const convo = byUser.get(p.id)
        if (convo) {
          convo.name = p.company_name ?? p.full_name ?? 'Member'
          convo.role = p.role
        }
      }
    }

    setSupportConvos(
      Array.from(byUser.values()).sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
      ),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Refresh the lists when new messages arrive anywhere.
  useEffect(() => {
    const channel = supabase
      .channel('admin-messages-watch')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => load(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages' },
        () => load(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  async function openCompose() {
    setComposeOpen(true)
    if (allUsers.length === 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('role', 'admin')
        .order('created_at', { ascending: false })
        .limit(500)
      setAllUsers((data ?? []) as Profile[])
    }
  }

  const visibleInquiries = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return inquiryConvos
    return inquiryConvos.filter(
      (c) =>
        c.buyerName.toLowerCase().includes(q) || c.supplierName.toLowerCase().includes(q),
    )
  }, [inquiryConvos, search])

  const visibleSupport = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return supportConvos
    return supportConvos.filter((c) => c.name.toLowerCase().includes(q))
  }, [supportConvos, search])

  const composeMatches = useMemo(() => {
    const q = composeSearch.trim().toLowerCase()
    if (!q) return allUsers.slice(0, 12)
    return allUsers
      .filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.company_name?.toLowerCase().includes(q),
      )
      .slice(0, 12)
  }, [allUsers, composeSearch])

  return (
    <div>
      <AdminPageHeader
        title="Messages"
        description="Monitor every conversation and reach out to any buyer or supplier."
        actions={
          <Button onClick={openCompose}>
            <PenSquare className="h-4 w-4" />
            New support message
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Conversation list */}
        <div className="flex flex-col border border-border bg-card">
          <div className="flex border-b border-border">
            {(
              [
                ['inquiries', 'Inquiry chats', MessageSquare],
                ['support', 'Support', LifeBuoy],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors',
                  tab === key
                    ? 'bg-ink text-[#F5EDE4]'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {key === 'support' && supportConvos.some((c) => c.unreadFromUser > 0) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </button>
            ))}
          </div>

          <div className="relative border-b border-border p-3">
            <Search className="pointer-events-none absolute left-6 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input
              type="search"
              placeholder="Search parties…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-border bg-surface pl-8 text-sm text-text-primary"
            />
          </div>

          <div className="max-h-[600px] flex-1 overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : tab === 'inquiries' ? (
              visibleInquiries.length === 0 ? (
                <p className="p-8 text-center text-sm text-text-secondary">
                  No inquiry conversations yet.
                </p>
              ) : (
                visibleInquiries.map((convo) => (
                  <button
                    key={convo.id}
                    type="button"
                    onClick={() => {
                      setSelectedInquiry(convo.id)
                      setSelectedSupportUser(null)
                    }}
                    className={cn(
                      'block w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface',
                      selectedInquiry === convo.id && 'bg-surface',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {convo.buyerName} ↔ {convo.supplierName}
                      </p>
                      <span className="shrink-0 font-mono text-[9px] text-text-muted">
                        {relativeTime(convo.lastMessageAt ?? convo.updated_at)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-text-secondary">
                        {convo.lastMessage ?? 'No messages yet'}
                      </p>
                      <InquiryStatusBadge status={convo.status} />
                    </div>
                  </button>
                ))
              )
            ) : visibleSupport.length === 0 ? (
              <p className="p-8 text-center text-sm text-text-secondary">
                No support conversations yet. Start one with “New support message”.
              </p>
            ) : (
              visibleSupport.map((convo) => (
                <button
                  key={convo.userId}
                  type="button"
                  onClick={() => {
                    setSelectedSupportUser(convo.userId)
                    setSelectedInquiry(null)
                  }}
                  className={cn(
                    'block w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface',
                    selectedSupportUser === convo.userId && 'bg-surface',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {convo.name}
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">
                        {convo.role}
                      </span>
                    </p>
                    <span className="shrink-0 font-mono text-[9px] text-text-muted">
                      {relativeTime(convo.lastMessageAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-text-secondary">{convo.lastMessage}</p>
                    {convo.unreadFromUser > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[9px] text-white">
                        {convo.unreadFromUser}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread panel */}
        <div className="overflow-hidden border border-border">
          {selectedInquiry && profile ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-border bg-surface px-4 py-2.5">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-muted">
                  Read-only oversight — parties cannot see admin presence
                </p>
              </div>
              <ChatThread inquiryId={selectedInquiry} currentUserId={profile.id} readOnly />
            </div>
          ) : selectedSupportUser && profile ? (
            <SupportThread
              threadUserId={selectedSupportUser}
              currentUserId={profile.id}
              isAdminView
              emptyHint="Start the conversation — the user is notified in their portal."
            />
          ) : (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center bg-card text-center">
              <MessageSquare className="h-9 w-9 text-text-muted" />
              <p className="mt-3 text-sm text-text-secondary">
                Select a conversation to read it
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Compose dialog */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message a user</DialogTitle>
            <DialogDescription>
              Pick a buyer or supplier to open a direct support conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              autoFocus
              placeholder="Search by name or company…"
              value={composeSearch}
              onChange={(e) => setComposeSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {composeMatches.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setComposeOpen(false)
                  setTab('support')
                  setSelectedSupportUser(user.id)
                  setSelectedInquiry(null)
                }}
                className="flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-surface"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {user.company_name ?? user.full_name ?? 'Member'}
                  </p>
                  {user.full_name && user.company_name && (
                    <p className="text-xs text-text-secondary">{user.full_name}</p>
                  )}
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">
                  {user.role}
                </span>
              </button>
            ))}
            {composeMatches.length === 0 && (
              <p className="py-6 text-center text-sm text-text-secondary">No users found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
