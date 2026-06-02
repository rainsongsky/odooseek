import { expect, test } from '@playwright/test'
import { getE2ECredentials, loginViaUi } from './fixtures/auth'
import { ensureListView, hrAppTile } from './fixtures/views'

/**
 * MVAM smoke: Menu → Action → View (list) → Model (form record).
 * Uses HR Employees as the reference module (requires hr + demo data in Odoo).
 */
test.describe('MVAM main flow', () => {
  test.beforeEach(async ({ page }) => {
    getE2ECredentials()
    await loginViaUi(page)
  })

  test('login → app menu → list → form', async ({ page }) => {
    await page.goto('/menu')
    await expect(page.getByTestId('app-menu')).toBeVisible()

    const tile = hrAppTile(page)
    await expect(tile.first()).toBeVisible({ timeout: 30_000 })
    await tile.first().click()

    // App root may resolve to dedicated /hr/* or generic /web?action=
    await expect(page).toHaveURL(/\/hr\/|\/web\?action=/, { timeout: 30_000 })
    await ensureListView(page)

    const firstRow = page.getByTestId('list-row').first()
    await expect(firstRow).toBeVisible({ timeout: 30_000 })
    const recordId = await firstRow.getAttribute('data-record-id')
    expect(recordId).toBeTruthy()

    await firstRow.click()

    await expect(page.getByTestId('odoo-form-view')).toBeVisible({ timeout: 30_000 })
  })

  test('direct list route opens form on row click', async ({ page }) => {
    await page.goto('/hr/employees')
    await ensureListView(page)

    const row = page.getByTestId('list-row').first()
    await expect(row).toBeVisible({ timeout: 30_000 })
    const recordId = await row.getAttribute('data-record-id')
    await row.click()

    await expect(page).toHaveURL(new RegExp(`/hr/employee/${recordId}`))
    await expect(page.getByTestId('odoo-form-view')).toBeVisible()
  })
})
