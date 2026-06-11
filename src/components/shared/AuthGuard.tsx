import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'
import type { PortalZone } from '@/types/app'
import { ROLE_HOME_PATHS, canAccessZone } from '@/types/app'
import type { UserRole } from '@/types/database.types'

export interface AuthGuardProps {
  children: ReactNode
  allowedRoles?: UserRole[]
  zone?: PortalZone
  requireActive?: boolean
  fallbackPath?: string
}

export function AuthGuard({
  children,
  allowedRoles,
  zone,
  requireActive = true,
  fallbackPath = '/auth/login',
}: AuthGuardProps) {
  const { isLoading, isAuthenticated, role, profile } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !role) {
    return <Navigate to={fallbackPath} state={{ from: location.pathname }} replace />
  }

  if (requireActive && profile?.status !== 'active') {
    if (role === 'supplier') {
      return <Navigate to="/supplier-portal/pending" replace />
    }
    return <Navigate to="/auth/pending" replace />
  }

  if (zone && !canAccessZone(role, zone)) {
    return <Navigate to={ROLE_HOME_PATHS[role]} replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_HOME_PATHS[role]} replace />
  }

  return <>{children}</>
}

export default AuthGuard
