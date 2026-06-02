import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTranslations } from 'use-intl'
import { useAuth } from '../lib/auth'
import { OAuthCallbackPage } from './auth/oauth/callback'

function LoginPage() {
  const navigate = useNavigate()
  const t = useTranslations()
  const { isAuthenticated, refetch, session } = useAuth()
  const [db, setDb] = useState(session.db ?? '')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) navigate({ to: '/dashboard' })
  }, [isAuthenticated, navigate])

  // If this is an OAuth callback, render the callback handler instead
  if (window.location.pathname === '/auth/oauth/callback') {
    return <OAuthCallbackPage />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!db.trim()) {
      setError('Database name is required')
      return
    }
    if (!login.trim()) {
      setError('Username is required')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ db: db.trim(), login: login.trim(), password }),
      })
      const data = await res.json()

      // Check JSON-RPC error from Odoo (BFF returns 200 for Odoo errors)
      if (data?.error) {
        const errMsg =
          data.error?.data?.message ||
          data.error?.message ||
          data.error?.data?.arguments?.[0] ||
          'Login failed'
        throw new Error(typeof errMsg === 'string' ? errMsg : 'Login failed')
      }

      if (!res.ok) {
        if (res.status === 401) throw new Error('Session expired. Please login again.')
        throw new Error(data?.message || `Server error (${res.status})`)
      }

      if (!data.authenticated) {
        throw new Error('Login failed — check your credentials')
      }
      refetch()
      navigate({ to: '/dashboard' })
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('Cannot connect to server. Is Odoo running?')
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="w-full max-w-sm">
        <h2 className="mb-8 text-center text-2xl font-semibold text-text-primary">
          {t('login.title')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="db" className="mb-1.5 block text-xs font-medium text-text-secondary">
              Database
            </label>
            <input
              id="db"
              type="text"
              value={db}
              onChange={(e) => setDb(e.target.value)}
              placeholder="postgres"
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="login" className="mb-1.5 block text-xs font-medium text-text-secondary">
              Email / Username
            </label>
            <input
              id="login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-medium text-text-secondary"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete="current-password"
                className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-1 py-0.5 text-xs text-text-muted hover:text-text-primary"
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit"
            className="w-full cursor-pointer rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in...' : t('login.submit')}
          </button>
        </form>

        <div className="mt-6 border-t border-border-subtle pt-4">
          <p className="mb-3 text-center text-xs text-text-muted">Or sign in with</p>
          <button
            type="button"
            onClick={() => {
              const oauthUrl = `/api/odoo-http/auth_oauth/signin?provider=google&redirect=${encodeURIComponent(`${window.location.origin}/auth/oauth/callback`)}`
              window.location.href = oauthUrl
            }}
            className="w-full rounded-lg border border-border-default bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-hover"
          >
            Google
          </button>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/login')({
  component: LoginPage,
})
