import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './lib/auth'
import { I18nProvider } from './lib/i18n'
import { routeTree } from './routeTree.gen'
import { ThemeProvider } from './themes'
import './index.css'
import './styles/odoo-icons.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>
              <RouterProvider router={router} />
            </I18nProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
