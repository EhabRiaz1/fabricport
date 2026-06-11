import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AdminTableProps {
  children: ReactNode
  className?: string
}

export function AdminTable({ children, className }: AdminTableProps) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  )
}

export function AdminTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border-cream text-text-dark-secondary">{children}</tr>
    </thead>
  )
}

export function AdminTableHeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-3 font-mono text-[10px] uppercase tracking-widest', className)}>
      {children}
    </th>
  )
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border-cream">{children}</tbody>
}

export function AdminTableRow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <tr className={cn('text-text-dark', className)}>{children}</tr>
}

export function AdminTableCell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <td className={cn('px-4 py-3', className)}>{children}</td>
}

export default AdminTable
