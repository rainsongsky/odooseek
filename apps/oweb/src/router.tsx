import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { lazy } from 'react'
import { RootLayout } from './routes/__root'
import { HomePage } from './routes/home'

const LazyLoginPage = lazy(() => import('./routes/login').then((m) => ({ default: m.LoginPage })))
const LazyDashboardPage = lazy(() =>
  import('./routes/dashboard').then((m) => ({ default: m.DashboardPage })),
)
const LazySettingsPage = lazy(() =>
  import('./routes/settings').then((m) => ({ default: m.SettingsPage })),
)

const rootRoute = createRootRoute({ component: RootLayout })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LazyLoginPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: LazyDashboardPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: LazySettingsPage,
})

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, dashboardRoute, settingsRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
