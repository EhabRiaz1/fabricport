import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Ban,
  CheckCircle2,
  Copy,
  KeyRound,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AdminTable,
  AdminTableBody,
  AdminTableCell,
  AdminTableHead,
  AdminTableHeaderCell,
  AdminTableRow,
} from '@/pages/admin/components/AdminTable'
import { AdminPageHeader } from '@/pages/admin/components/AdminPageHeader'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from '@/stores/toast'
import type { Profile } from '@/types/database.types'

type RoleFilter = 'all' | 'admin' | 'supplier' | 'buyer'

interface AdminUser {
  id: string
  email: string | null
  created_at: string
  last_sign_in_at: string | null
  banned: boolean
  profile: Profile | null
  supplier: { id: string; brand_name: string; slug: string; is_verified: boolean } | null
}

interface TempCredentials {
  email: string
  password: string
  context: 'created' | 'reset'
}

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-accent/10 text-accent',
  supplier: 'bg-bronze/15 text-bronze',
  buyer: 'bg-success/10 text-success',
}

async function callAdminUsers<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw new Error(error.message)
  if (data && data.ok === false) throw new Error(data.error ?? 'Request failed')
  return data as T
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>(() => {
    const param = new URLSearchParams(window.location.search).get('role')
    return param === 'admin' || param === 'supplier' || param === 'buyer' ? param : 'all'
  })
  const [busyId, setBusyId] = useState<string | null>(null)

  // Create form state
  const [createOpen, setCreateOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'supplier' | 'buyer'>('buyer')
  const [newFullName, setNewFullName] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newWhatsapp, setNewWhatsapp] = useState('')
  const [creating, setCreating] = useState(false)

  // Temp credentials modal
  const [credentials, setCredentials] = useState<TempCredentials | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await callAdminUsers<{ users: AdminUser[] }>({ action: 'list' })
      setUsers(data.users ?? [])
    } catch (err) {
      toast.error('Could not load users', err instanceof Error ? err.message : undefined)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users
      .filter((u) => (roleFilter === 'all' ? true : u.profile?.role === roleFilter))
      .filter((u) => {
        if (!q) return true
        return (
          u.email?.toLowerCase().includes(q) ||
          u.profile?.full_name?.toLowerCase().includes(q) ||
          u.profile?.company_name?.toLowerCase().includes(q) ||
          u.supplier?.brand_name?.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [users, search, roleFilter])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!newEmail.trim()) return
    setCreating(true)
    try {
      const data = await callAdminUsers<{ tempPassword: string }>({
        action: 'create',
        email: newEmail.trim(),
        role: newRole,
        fullName: newFullName.trim() || undefined,
        companyName: newCompany.trim() || undefined,
        brandName: newRole === 'supplier' ? newCompany.trim() || undefined : undefined,
        whatsapp: newWhatsapp.trim() || undefined,
        verifySupplier: true,
      })
      setCreateOpen(false)
      setCredentials({ email: newEmail.trim(), password: data.tempPassword, context: 'created' })
      setNewEmail('')
      setNewFullName('')
      setNewCompany('')
      setNewWhatsapp('')
      setNewRole('buyer')
      await loadUsers()
    } catch (err) {
      toast.error('Create failed', err instanceof Error ? err.message : undefined)
    }
    setCreating(false)
  }

  async function handleResetPassword(user: AdminUser) {
    setBusyId(user.id)
    try {
      const data = await callAdminUsers<{ tempPassword: string }>({
        action: 'reset_password',
        userId: user.id,
      })
      setCredentials({
        email: user.email ?? 'user',
        password: data.tempPassword,
        context: 'reset',
      })
    } catch (err) {
      toast.error('Reset failed', err instanceof Error ? err.message : undefined)
    }
    setBusyId(null)
  }

  async function handleToggleStatus(user: AdminUser) {
    const next = user.profile?.status === 'suspended' ? 'active' : 'suspended'
    setBusyId(user.id)
    try {
      await callAdminUsers({ action: 'set_status', userId: user.id, status: next })
      toast.success(next === 'suspended' ? 'Account suspended' : 'Account reactivated')
      await loadUsers()
    } catch (err) {
      toast.error('Status change failed', err instanceof Error ? err.message : undefined)
    }
    setBusyId(null)
  }

  async function handleDelete(user: AdminUser) {
    if (!window.confirm(`Permanently delete ${user.email}? This cannot be undone.`)) return
    setBusyId(user.id)
    try {
      await callAdminUsers({ action: 'delete', userId: user.id })
      toast.success('Account deleted')
      await loadUsers()
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : undefined)
    }
    setBusyId(null)
  }

  function copyCredentials() {
    if (!credentials) return
    navigator.clipboard
      .writeText(`Email: ${credentials.email}\nPassword: ${credentials.password}`)
      .then(() => toast.success('Copied to clipboard'))
      .catch(() => undefined)
  }

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Create accounts for any role, reset passwords, and control access."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            New user
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            type="search"
            placeholder="Search email, name, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-surface pl-9 text-text-primary"
          />
        </div>
        <div className="flex border border-border bg-surface">
          {(['all', 'admin', 'supplier', 'buyer'] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role)}
              className={cn(
                'px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                roleFilter === role
                  ? 'bg-ink text-[#F5EDE4]'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <AdminTable>
              <AdminTableHead>
                <AdminTableHeaderCell>User</AdminTableHeaderCell>
                <AdminTableHeaderCell>Role</AdminTableHeaderCell>
                <AdminTableHeaderCell>Status</AdminTableHeaderCell>
                <AdminTableHeaderCell>Last sign-in</AdminTableHeaderCell>
                <AdminTableHeaderCell className="text-right">Actions</AdminTableHeaderCell>
              </AdminTableHead>
              <AdminTableBody>
                {visible.map((user) => {
                  const role = user.profile?.role ?? 'buyer'
                  const status = user.profile?.status ?? 'active'
                  const suspended = status === 'suspended'
                  return (
                    <AdminTableRow key={user.id}>
                      <AdminTableCell>
                        <div>
                          <p className="font-medium">{user.email}</p>
                          <p className="text-xs text-text-dark-secondary">
                            {user.supplier?.brand_name ??
                              user.profile?.company_name ??
                              user.profile?.full_name ??
                              '—'}
                          </p>
                        </div>
                      </AdminTableCell>
                      <AdminTableCell>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]',
                            ROLE_STYLES[role],
                          )}
                        >
                          {role === 'admin' && <ShieldCheck className="h-3 w-3" />}
                          {role}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>
                        <span
                          className={cn(
                            'font-mono text-[10px] uppercase tracking-[0.12em]',
                            suspended
                              ? 'text-danger'
                              : status === 'pending'
                                ? 'text-warning'
                                : 'text-success',
                          )}
                        >
                          {status}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell>
                        <span className="font-mono text-xs text-text-dark-secondary">
                          {user.last_sign_in_at
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : 'Never'}
                        </span>
                      </AdminTableCell>
                      <AdminTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Reset password"
                            disabled={busyId === user.id}
                            onClick={() => handleResetPassword(user)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={suspended ? 'Reactivate account' : 'Suspend account'}
                            disabled={busyId === user.id}
                            onClick={() => handleToggleStatus(user)}
                            className={suspended ? 'text-success' : 'text-warning'}
                          >
                            {suspended ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Ban className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete account"
                            disabled={busyId === user.id}
                            onClick={() => handleDelete(user)}
                            className="text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </AdminTableCell>
                    </AdminTableRow>
                  )
                })}
              </AdminTableBody>
            </AdminTable>
          )}
          {!loading && visible.length === 0 && (
            <p className="p-8 text-center text-sm text-text-dark-secondary">
              No users match your filters.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new account</DialogTitle>
            <DialogDescription>
              A temporary password is generated and shown once — share it with the user securely.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <div className="flex border border-border bg-surface">
                {(['buyer', 'supplier', 'admin'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setNewRole(role)}
                    className={cn(
                      'flex-1 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors',
                      newRole === role
                        ? 'bg-ink text-[#F5EDE4]'
                        : 'text-text-secondary hover:text-text-primary',
                    )}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-name">Full name</Label>
                <Input
                  id="new-name"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-company">
                  {newRole === 'supplier' ? 'Brand / company' : 'Company'}
                </Label>
                <Input
                  id="new-company"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-whatsapp">WhatsApp</Label>
              <Input
                id="new-whatsapp"
                type="tel"
                placeholder="+92 300 0000000"
                value={newWhatsapp}
                onChange={(e) => setNewWhatsapp(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creating…' : 'Create account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Temp credentials dialog */}
      <Dialog open={credentials !== null} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {credentials?.context === 'created' ? 'Account created' : 'Password reset'}
            </DialogTitle>
            <DialogDescription>
              These credentials are shown only once. Copy them now and share securely.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3">
              <div className="border border-border bg-surface p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-muted">
                  Email
                </p>
                <p className="mt-1 font-mono text-sm text-text-primary">{credentials.email}</p>
                <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-text-muted">
                  Temporary password
                </p>
                <p className="mt-1 font-mono text-lg font-semibold tracking-wide text-accent">
                  {credentials.password}
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={copyCredentials}>
                  <Copy className="h-4 w-4" />
                  Copy both
                </Button>
                <Button onClick={() => setCredentials(null)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
