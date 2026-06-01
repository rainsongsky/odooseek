import { createRootRoute, Outlet } from '@tanstack/react-router'
import { CommandPalette } from '../components/CommandPalette'
import { HomeMenuOverlay } from '../components/HomeMenu'
import { Navbar } from '../components/Navbar'
import { useOdooBus } from '../hooks/useOdooBus'

function RootLayout() {
  const { connected } = useOdooBus()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-root">
      <Navbar />
      <HomeMenuOverlay />
      <CommandPalette />
      <main className="flex min-h-0 flex-1 flex-col page-enter">
        <Outlet />
      </main>
      <div className="flex items-center justify-end border-t border-border-subtle bg-root px-4 py-1">
        <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              connected ? 'bg-success' : 'bg-danger'
            }`}
          />
          {connected ? 'Live' : 'Disconnected'}
        </span>
      </div>
    </div>
  )
}

function RootErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md rounded-lg border border-danger/30 bg-surface p-6 text-center">
        <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
        <p className="mt-2 text-sm text-danger">{error.message}</p>
        <button
          type="button"
          className="mt-4 rounded bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90"
          onClick={reset}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootErrorComponent,
})
