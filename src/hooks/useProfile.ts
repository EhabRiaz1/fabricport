import { useAuth } from '@/contexts/AuthContext'

export function useProfile() {
  const { profile, user, isLoading, isAuthenticated, role, refreshProfile, signOut } =
    useAuth()

  return {
    profile,
    user,
    isLoading,
    isAuthenticated,
    role,
    refreshProfile,
    signOut,
  }
}
