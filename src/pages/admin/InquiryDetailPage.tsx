import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { InquiryStatus, Message, Profile } from '@/types/database.types'
import { AdminPageHeader } from './components/AdminPageHeader'

interface InquiryDetail {
  id: string
  status: InquiryStatus
  created_at: string
  buyer?: Profile | null
  supplier?: { brand_name: string; slug: string } | null
}

interface MessageRow extends Message {
  sender?: Profile | null
}

export default function InquiryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadInquiry = useCallback(async () => {
    if (!id) return

    setLoading(true)
    const [inquiryRes, messagesRes] = await Promise.all([
      supabase
        .from('inquiries')
        .select(`
          id, status, created_at,
          buyer:buyers(profile:profiles(*)),
          supplier:suppliers(brand_name, slug)
        `)
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('messages')
        .select('*, sender:profiles(*)')
        .eq('inquiry_id', id)
        .order('created_at', { ascending: true }),
    ])

    if (inquiryRes.data) {
      const buyer = Array.isArray(inquiryRes.data.buyer)
        ? inquiryRes.data.buyer[0]
        : inquiryRes.data.buyer
      const profile = buyer?.profile
        ? Array.isArray(buyer.profile)
          ? buyer.profile[0]
          : buyer.profile
        : null
      const supplier = Array.isArray(inquiryRes.data.supplier)
        ? inquiryRes.data.supplier[0]
        : inquiryRes.data.supplier

      setInquiry({
        id: inquiryRes.data.id,
        status: inquiryRes.data.status,
        created_at: inquiryRes.data.created_at,
        buyer: profile,
        supplier,
      })
    }

    setMessages(
      (messagesRes.data ?? []).map((msg) => ({
        ...msg,
        sender: Array.isArray(msg.sender) ? msg.sender[0] : msg.sender,
      })) as MessageRow[],
    )
    setLoading(false)
  }, [id])

  useEffect(() => {
    loadInquiry()
  }, [loadInquiry])

  if (loading) {
    return (
      <div>
        <AdminPageHeader title="Inquiry Detail" />
        <Skeleton className="h-96 w-full bg-border-cream" />
      </div>
    )
  }

  if (!inquiry) {
    return (
      <div>
        <AdminPageHeader title="Inquiry Not Found" />
        <Button variant="ghost" asChild>
          <Link to="/admin/inquiries">
            <ArrowLeft className="h-4 w-4" />
            Back to inquiries
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader
        title="Inquiry Detail"
        description="Read-only conversation view."
        actions={
          <Button variant="ghost" asChild>
            <Link to="/admin/inquiries">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              Buyer
            </p>
            <p className="mt-1 font-medium">{inquiry.buyer?.full_name ?? '—'}</p>
            <p className="text-sm text-text-dark-secondary">
              {inquiry.buyer?.company_name ?? ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              Supplier
            </p>
            <p className="mt-1 font-medium">{inquiry.supplier?.brand_name ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              Status
            </p>
            <Badge variant="status" className="mt-2">
              {inquiry.status}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="text-sm text-text-dark-secondary">No messages in this thread.</p>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isBuyer = msg.sender?.role === 'buyer'
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'max-w-[80%] border border-border-cream px-4 py-3',
                      isBuyer ? 'mr-auto bg-surface/5' : 'ml-auto bg-accent/5',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-medium text-text-dark">
                        {msg.sender?.full_name ?? 'Unknown'}
                      </span>
                      <span className="font-mono text-[10px] text-text-dark-secondary">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-text-dark whitespace-pre-wrap">
                      {msg.content ?? '(attachment only)'}
                    </p>
                    {msg.attachments?.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {msg.attachments.map((att) => (
                          <li key={att.url}>
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-accent hover:underline"
                            >
                              {att.name}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
