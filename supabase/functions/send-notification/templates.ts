/**
 * Per-notification-type email content. Each `type` dispatched from the app
 * (grep src for dispatchNotification) maps to a subject, heading, intro, detail
 * rows and a CTA into the right portal page. Unknown types fall back to the
 * generic title / body the caller supplied.
 */
import { SITE_URL, type RenderEmailInput } from '../_shared/email-layout.ts'

export type RecipientRole = 'buyer' | 'supplier' | 'admin' | null

export interface NotificationContext {
  type: string
  title: string
  body?: string | null
  data?: Record<string, unknown> | null
  recipientName?: string | null
  recipientRole: RecipientRole
}

export interface EmailContent extends RenderEmailInput {
  subject: string
  /** Deep link appended to the WhatsApp text as well. */
  ctaUrl: string
}

function str(data: Record<string, unknown> | null | undefined, key: string): string | null {
  const v = data?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function portal(role: RecipientRole): string {
  if (role === 'supplier') return `${SITE_URL}/supplier-portal`
  if (role === 'admin') return `${SITE_URL}/admin`
  return `${SITE_URL}/buyer`
}

/** Optional invoice details, shown only when the caller passes them in `data`. */
function invoiceRows(data: Record<string, unknown> | null | undefined) {
  const rows: { label: string; value: string }[] = []
  const number = str(data, 'invoice_number')
  const total = str(data, 'total')
  const terms = str(data, 'payment_terms')
  const due = str(data, 'due_date')
  if (number) rows.push({ label: 'Invoice', value: number })
  if (total) rows.push({ label: 'Total', value: total })
  if (terms) rows.push({ label: 'Payment terms', value: terms })
  if (due) rows.push({ label: 'Due date', value: due })
  return rows
}

function greeting(ctx: NotificationContext): string {
  return ctx.recipientName ? `Hi ${ctx.recipientName},` : 'Hi,'
}

export function buildEmail(ctx: NotificationContext): EmailContent {
  const base = portal(ctx.recipientRole)
  const inquiryId = str(ctx.data, 'inquiry_id')
  const sampleId = str(ctx.data, 'sample_request_id')
  const invoiceId = str(ctx.data, 'invoice_id')
  const body = ctx.body?.trim() || null

  switch (ctx.type) {
    case 'inquiry_received': {
      const url = inquiryId ? `${base}/inquiries/${inquiryId}` : `${base}/inquiries`
      return {
        subject: 'New inquiry on FabricPort',
        preheader: body ?? 'A buyer has sent you an inquiry.',
        heading: 'You have a new inquiry',
        intro: [greeting(ctx), body ?? 'A buyer has sent you an inquiry.'],
        rows: [{ label: 'Response target', value: 'Within 1 business day' }],
        cta: { label: 'Open the inquiry', url },
        ctaUrl: url,
        outro: 'Replying quickly keeps your response rate high and your fabrics ranked well.',
        recipientRole: ctx.recipientRole,
      }
    }
    case 'message_received': {
      const url = sampleId
        ? `${base}/samples/${sampleId}`
        : inquiryId
          ? `${base}/inquiries/${inquiryId}`
          : `${base}/inquiries`
      return {
        subject: ctx.title || 'New message on FabricPort',
        preheader: body ?? 'You have a new message.',
        heading: ctx.title || 'You have a new message',
        intro: [greeting(ctx), body ? `"${body}"` : 'You have a new message waiting.'],
        cta: { label: 'Read and reply', url },
        ctaUrl: url,
        recipientRole: ctx.recipientRole,
      }
    }
    case 'support_message': {
      const url = ctx.recipientRole === 'admin' ? `${base}/messages` : `${base}/support`
      return {
        subject: 'New message from the FabricPort team',
        preheader: body ?? 'The FabricPort team has replied to you.',
        heading: 'The FabricPort team sent you a message',
        intro: [greeting(ctx), body ? `"${body}"` : 'Open your support thread to read it.'],
        cta: { label: 'Open support', url },
        ctaUrl: url,
        recipientRole: ctx.recipientRole,
      }
    }
    case 'sample_requested': {
      const url = sampleId ? `${base}/samples/${sampleId}` : `${base}/samples`
      return {
        subject: 'New sample request on FabricPort',
        preheader: body ?? 'A buyer has requested a swatch.',
        heading: 'A buyer wants a swatch',
        intro: [greeting(ctx), body ?? 'A buyer has requested a sample of one of your fabrics.'],
        cta: { label: 'Review the request', url },
        ctaUrl: url,
        outro: 'Approve it and add a tracking number once it ships; the buyer is notified at each step.',
        recipientRole: ctx.recipientRole,
      }
    }
    case 'sample_status_changed': {
      const url = sampleId ? `${base}/samples/${sampleId}` : `${base}/samples`
      return {
        subject: ctx.title || 'Sample request update',
        preheader: body ?? 'Your sample request has been updated.',
        heading: ctx.title || 'Sample request update',
        intro: [greeting(ctx), body ?? 'Your sample request has been updated.'],
        cta: { label: 'View sample request', url },
        ctaUrl: url,
        recipientRole: ctx.recipientRole,
      }
    }
    case 'invoice_sent': {
      const url = invoiceId ? `${base}/invoices/${invoiceId}` : `${base}/invoices`
      return {
        subject: 'New invoice on FabricPort',
        preheader: body ?? 'A supplier has issued you an invoice.',
        heading: 'You have a new invoice',
        intro: [greeting(ctx), body ?? 'A supplier has issued an invoice to you.'],
        rows: invoiceRows(ctx.data),
        cta: { label: 'View invoice', url },
        ctaUrl: url,
        recipientRole: ctx.recipientRole,
      }
    }
    case 'payment_recorded': {
      const url = invoiceId ? `${base}/invoices/${invoiceId}` : `${base}/invoices`
      return {
        subject: 'Payment recorded on your invoice',
        preheader: body ?? 'A payment has been recorded.',
        heading: 'Payment recorded',
        intro: [greeting(ctx), body ?? 'A payment has been recorded against your invoice.'],
        cta: { label: 'View invoice', url },
        ctaUrl: url,
        recipientRole: ctx.recipientRole,
      }
    }
    case 'listing_update': {
      const url = `${base}/listing-request`
      return {
        subject: 'Listing request update',
        preheader: body ?? 'Your listing request has moved forward.',
        heading: 'Your listing request has been updated',
        intro: [greeting(ctx), body ?? 'Your listing request status has changed.'],
        cta: { label: 'View listing requests', url },
        ctaUrl: url,
        recipientRole: ctx.recipientRole,
      }
    }
    default: {
      const url = `${base}/dashboard`
      return {
        subject: ctx.title,
        preheader: body ?? ctx.title,
        heading: ctx.title,
        intro: [greeting(ctx), body ?? 'Open your FabricPort portal for details.'],
        cta: { label: 'Open FabricPort', url },
        ctaUrl: url,
        recipientRole: ctx.recipientRole,
      }
    }
  }
}
