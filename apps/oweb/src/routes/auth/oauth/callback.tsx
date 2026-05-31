import { useEffect, useState } from 'react'

export function OAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    if (accessToken) {
      const db = sessionStorage.getItem('odoo_db') || ''
      fetch('/api/session/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ db, login: accessToken, password: accessToken }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.result?.authenticated) window.location.href = '/dashboard'
          else setError('OAuth authentication failed')
        })
        .catch(() => setError('OAuth authentication failed'))
      return
    }
    setError('No access token received')
  }, [])

  if (error) return null
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      <span className="ml-3 text-text-secondary">Signing in...</span>
    </div>
  )
}
