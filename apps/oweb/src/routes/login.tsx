import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

export function LoginPage() {
  const navigate = useNavigate()
  const [db, setDb] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { authenticate } = await import('../lib/api')
      await authenticate(db, login, password)
      navigate({ to: '/dashboard' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const handleGuest = () => {
    navigate({ to: '/dashboard' })
  }

  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="w-full max-w-sm">
        <h2 className="mb-8 text-center text-2xl font-semibold text-text-primary">
          Connect to Odoo
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Database
            </label>
            <input
              type="text"
              value={db}
              onChange={(e) => setDb(e.target.value)}
              placeholder="postgres"
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Email / Username
            </label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="admin"
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Authenticate'}
          </button>

          <button
            type="button"
            onClick={handleGuest}
            className="w-full cursor-pointer rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-hover"
          >
            Continue as Guest
          </button>
        </form>
      </div>
    </div>
  )
}
