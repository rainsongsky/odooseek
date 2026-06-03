import { expect, test } from '@playwright/test'
import { getE2ECredentials, loginViaUi } from './fixtures/auth'

test.describe('Authentication', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login', { timeout: 15_000 })
  })

  test('login sets session and redirects to dashboard', async ({ page }) => {
    const creds = getE2ECredentials()
    await loginViaUi(page, creds)

    // Verify we're authenticated — nav elements visible
    await expect(page.getByTestId('nav-settings')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 })
  })

  test('logout redirects to login', async ({ page }) => {
    const creds = getE2ECredentials()
    await loginViaUi(page, creds)

    // Click logout via settings
    await page.getByTestId('nav-settings').click()
    await page.getByTestId('settings-logout').click()

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
  })

  test('session expiry redirects to login', async ({ page }) => {
    // Visit a protected route without valid session
    await page.goto('/hr/employees')
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
  })
})
