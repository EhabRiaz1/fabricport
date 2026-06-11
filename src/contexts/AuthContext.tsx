import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { AuthUser } from '@/types/app'
import type { Profile, UserRole } from '@/types/database.types'

interface AuthContextValue {
  user: AuthUser | null
  session: Session | null
  profile: Profile | null
  role: UserRole | null
  isLoading: boolean
  isAuthenticated: boolean
  profileError: string | null
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const PROFILE_FETCH_TIMEOUT_MS = 10_000

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Profile fetch timed out')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const query = supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  const { data, error } = await withTimeout(query, PROFILE_FETCH_TIMEOUT_MS)

  if (error) throw new Error(error.message)
  return data
}

async function fetchProfileWithRetry(userId: string): Promise<Profile | null> {
  try {
    return await fetchProfile(userId)
  } catch {
    // One retry after a short backoff — transient network/refresh hiccups.
    await new Promise((resolve) => setTimeout(resolve, 600))
    return fetchProfile(userId)
  }
}

function buildAuthUser(session: Session, profile: Profile): AuthUser {
  return {
    id: session.user.id,
    email: session.user.email ?? '',
    role: profile.role,
    profile,
  }
}

export interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const userId = session?.user.id ?? null

  // IMPORTANT: the onAuthStateChange callback must stay synchronous.
  // supabase-js holds an internal auth lock while it runs; any supabase
  // query awaited inside it deadlocks every other query in the app.
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
      })
      .finally(() => setSessionLoaded(true))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Profile loads outside the auth lock, keyed on the authenticated user.
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      setProfileError(null)
      return
    }

    let cancelled = false
    setProfileLoading(true)
    setProfileError(null)

    fetchProfileWithRetry(userId)
      .then((nextProfile) => {
        if (cancelled) return
        setProfile(nextProfile)
        if (!nextProfile) setProfileError('No profile found for this account.')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setProfile(null)
        setProfileError(error instanceof Error ? error.message : 'Failed to load profile')
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      return
    }
    try {
      const nextProfile = await fetchProfileWithRetry(userId)
      setProfile(nextProfile)
      setProfileError(null)
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Failed to load profile')
    }
  }, [userId])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)
    setProfileError(null)
  }, [])

  const user = useMemo(() => {
    if (!session || !profile) return null
    return buildAuthUser(session, profile)
  }, [session, profile])

  const isLoading = !sessionLoaded || (Boolean(userId) && profileLoading)

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      role: profile?.role ?? null,
      isLoading,
      isAuthenticated: Boolean(user),
      profileError,
      signOut,
      refreshProfile,
    }),
    [user, session, profile, isLoading, profileError, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthProvider
