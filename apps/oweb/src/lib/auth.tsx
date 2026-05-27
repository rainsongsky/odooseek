import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useContext } from 'react'

interface AuthState {
  authenticated: boolean
  uid: number | null
  name: string | null
  username: string | null
  db: string | null
  isAdmin: boolean
  isSystem: boolean
  partnerId: number | null
  partnerDisplayName: string | null
  serverVersion: string | null
  homeActionId: number | null
}

const ANONYMOUS: AuthState = {
  authenticated: false,
  uid: null,
  name: null,
  username: null,
  db: null,
  isAdmin: false,
  isSystem: false,
  partnerId: null,
  partnerDisplayName: null,
  serverVersion: null,
  homeActionId: null,
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
