import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { DialogContainer } from './components/Dialog'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastContainer } from './components/Toast'
import { DialogProvider } from './hooks/useDialog'
import { HomeMenuProvider } from './hooks/useHomeMenu'
import { ToastProvider } from './hooks/useToast'
import { AuthProvider } from './lib/auth'
import { I18nProvider } from './lib/i18n'
import { routeTree } from './routeTree.gen'
import { ThemeProvider } from './themes'
import { resolveInitialTheme } from './themes/resolve-theme'
import { applyTheme } from './themes/theme-engine'
import './index.css'
import './styles/odoo-icons.css'

applyTheme(resolveInitialTheme())

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error.message === 'Session expired') return false
        return failureCount < 2
      },
    },
    mutations: {
      onError: (error) => {
        if (error.message === 'Session expired') return
        console.error('Mutation error:', error.message)
      },
    },
  },
})

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>
              <HomeMenuProvider>
                <DialogProvider>
                  <ToastProvider>
                    <RouterProvider router={router} />
                    <ToastContainer />
                  </ToastProvider>
                  <DialogContainer />
                </DialogProvider>
              </HomeMenuProvider>
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// Global error monitoring for unhandled errors and rejections
if (import.meta.env.PROD) {
  window.addEventListener('error', (e) => {
    console.error('Unhandled error:', e.error?.message ?? e.message, e.error?.stack)
  })
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason?.message ?? e.reason)
  })
}
