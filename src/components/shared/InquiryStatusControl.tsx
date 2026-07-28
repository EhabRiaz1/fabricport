import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { toast } from '@/stores/toast'
import { cn } from '@/lib/utils'
import type { InquiryStatus } from '@/types/database.types'

/**
 * Statuses each party may set. Mirrors the `guard_inquiry_admin_columns` trigger:
 * advancing the deal is the supplier's call, a buyer may only end their own.
 * Keep the two in step -- the DB is the enforcement point, this is just the UI.
 */
const SUPPLIER_STATUSES: InquiryStatus[] = [
  'open',
  'responded',
  'negotiating',
  'closed',
  'archived',
]
const BUYER_STATUSES: InquiryStatus[] = ['closed', 'archived']

export interface InquiryStatusControlProps {
  inquiryId: string
  status: InquiryStatus
  viewerRole: 'buyer' | 'supplier'
  onChanged?: (next: InquiryStatus) => void
  className?: string
}

export function InquiryStatusControl({
  inquiryId,
  status,
  viewerRole,
  onChanged,
  className,
}: InquiryStatusControlProps) {
  const [saving, setSaving] = useState(false)
  const options = viewerRole === 'supplier' ? SUPPLIER_STATUSES : BUYER_STATUSES

  async function handleChange(next: string) {
    const nextStatus = next as InquiryStatus
    if (nextStatus === status) return

    setSaving(true)
    const { error } = await supabase
      .from('inquiries')
      .update({ status: nextStatus })
      .eq('id', inquiryId)
    setSaving(false)

    if (error) {
      toast.error('Could not update status', error.message)
      return
    }

    toast.success('Status updated', `Now ${nextStatus}.`)
    onChanged?.(nextStatus)
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-secondary">
        Status
      </span>
      <Select value={status} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {/* The current value must always be selectable/visible even when the
              viewer isn't allowed to set it (e.g. a buyer looking at 'open'). */}
          {Array.from(new Set([status, ...options])).map((option) => (
            <SelectItem key={option} value={option} disabled={!options.includes(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default InquiryStatusControl
