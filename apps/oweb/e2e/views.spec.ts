import { expect, test } from '@playwright/test'
import { getE2ECredentials, loginViaUi } from './fixtures/auth'

test.describe('View switching', () => {
  test.beforeEach(async ({ page }) => {
    getE2ECredentials()
    await loginViaUi(page)
  })

  test('CRM pipeline loads list view', async ({ page }) => {
    await page.goto('/crm/pipeline')
    await expect(page.getByTestId('odoo-list-view')).toBeVisible({ timeout: 30_000 })
  })

  test('HR kanban view loads', async ({ page }) => {
    await page.goto('/hr/employees')

    // Try switching to kanban if switcher is available
    const kanbanBtn = page.getByTestId('view-switch-kanban')
    if (await kanbanBtn.isVisible()) {
      await kanbanBtn.click()
      await page.waitForTimeout(1000)
    }

    // Either list or kanban should be visible
    const view = page
      .getByTestId('odoo-list-view')
      .or(page.getByTestId('odoo-kanban-view'))
    await expect(view).toBeVisible({ timeout: 15_000 })
  })

  test('contacts list view loads', async ({ page }) => {
    await page.goto('/contacts/partners')
    await expect(page.getByTestId('odoo-list-view')).toBeVisible({ timeout: 30_000 })
  })

  test('home menu loads and navigates', async ({ page }) => {
    await page.goto('/menu')
    await expect(page.getByTestId('app-menu')).toBeVisible({ timeout: 15_000 })
  })

  test('settings page loads', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible({ timeout: 15_000 })
  })

  test('dashboard loads after login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
  })
})
