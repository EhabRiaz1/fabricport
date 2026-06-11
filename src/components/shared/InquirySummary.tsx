import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InquiryStatusBadge } from '@/components/shared/InquiryStatusBadge'
import type { InquiryWithRelations } from '@/types/app'

export interface InquirySummaryProps {
  inquiry: InquiryWithRelations
  viewerRole: 'buyer' | 'supplier'
}

export function InquirySummary({ inquiry, viewerRole }: InquirySummaryProps) {
  const counterparty =
    viewerRole === 'buyer'
      ? inquiry.supplier?.brand_name
      : inquiry.buyer?.company_name ?? inquiry.buyer?.full_name

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-text-dark">Inquiry Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-dark-secondary">Status</span>
          <InquiryStatusBadge status={inquiry.status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-dark-secondary">
            {viewerRole === 'buyer' ? 'Supplier' : 'Buyer'}
          </span>
          <span className="text-sm font-medium text-text-dark">{counterparty ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-dark-secondary">Created</span>
          <span className="font-mono text-xs text-text-dark-secondary">
            {new Date(inquiry.created_at).toLocaleDateString()}
          </span>
        </div>

        {inquiry.items && inquiry.items.length > 0 && (
          <div className="border-t border-border-cream pt-4">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-dark-secondary">
              Line Items
            </p>
            <ul className="space-y-2">
              {inquiry.items.map((item) => (
                <li key={item.id} className="text-sm text-text-dark">
                  <Link
                    to={`/fabric/${item.product?.slug}`}
                    className="font-medium hover:text-accent"
                  >
                    {item.product?.title ?? 'Product'}
                  </Link>
                  {item.quantity_meters != null && (
                    <span className="text-text-dark-secondary">
                      {' '}
                      · {item.quantity_meters}m
                    </span>
                  )}
                  {item.notes && (
                    <p className="mt-0.5 text-xs text-text-dark-secondary">{item.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
