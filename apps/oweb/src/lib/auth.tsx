import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext } from 'react'
import { redirect } from '@tanstack/react-router'

interface AuthState {
  authenticated: boolean
  uid: number | null
  name: string | null
  username: string | null
  db: string | null
  is_admin: boolean
  is_system: boolean
  partner_id: number | null
  partner_display_name: string | null
  server_version: string | null
  home_action_id: number | null
  user_context?: { lang?: string; tz?: string; uid?: number }
}

const ANONYMOUS: AuthState = {
  authenticated: false,
  uid: null,
  name: null,
  username: null,
  db: null,
  is_admin: false,
  is_system: false,
  partner_id: null,
  partner_display_name: null,
  server_version: null,
  home_action_id: null,
}

async function fetchSession(): Promise<AuthState> {
  const res = await fetch('/api/session', { credentials: 'include' })
  if (!res.ok) return ANONYMOUS
  return res.json()
}

const AuthContext = createContext<{
  isAuthenticated: boolean
  session: AuthState
  refetch: () => void
}>({
  isAuthenticated: false,
  session: ANONYMOUS,
  refetch: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data: session = ANONYMOUS } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: fetchSession,
    staleTime: 60_000,
    retry: false,
  })

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: session.authenticated,
        session,
        refetch: () => {
          queryClient.invalidateQueries({ queryKey: ['auth', 'session'] })
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

/** Route guard — call from `beforeLoad` to redirect unauthenticated users. */
export async function requireAuth(): Promise<void> {
  try {
    const res = await fetch('/api/session', { credentials: 'include' })
    if (!res.ok) throw redirect({ to: '/login' })
    const data = await res.json()
    if (!data.authenticated) throw redirect({ to: '/login' })
  } catch (e) {
    if (e instanceof Response || (e as { message?: string }).message?.includes('Redirect')) throw e
    throw redirect({ to: '/login' })
  }
}
