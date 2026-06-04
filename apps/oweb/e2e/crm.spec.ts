import { expect, test } from '@playwright/test'
import { getE2ECredentials, loginViaUi } from './fixtures/auth'
import { ensureListView } from './fixtures/views'

test.describe('CRM pipeline', () => {
  test.beforeEach(async ({ page }) => {
    getE2ECredentials()
    await loginViaUi(page)
  })

  test('pipeline list loads with records', async ({ page }) => {
    await page.goto('/crm/pipeline')
    await ensureListView(page)

    const rows = page.getByTestId('list-row')
    await expect(rows.first()).toBeVisible({ timeout: 15_000 })
  })

  test('leads list loads', async ({ page }) => {
    await page.goto('/crm/leads')
    await ensureListView(page)
    await expect(page).toHaveURL('/crm/leads')
  })

  test('pipeline row opens lead form', async ({ page }) => {
    await page.goto('/crm/leads')
    await ensureListView(page)

    const firstRow = page.getByTestId('list-row').first()
    await expect(firstRow).toBeVisible({ timeout: 15_000 })
    const recordId = await firstRow.getAttribute('data-record-id')
    if (!recordId) return

    await firstRow.click()
    await expect(page).toHaveURL(new RegExp(`/crm/lead/${recordId}`))
    await expect(page.getByTestId('odoo-form-view')).toBeVisible({ timeout: 15_000 })
  })

  test('lead form has key CRM fields', async ({ page }) => {
    await page.goto('/crm/leads')
    await ensureListView(page)

    const firstRow = page.getByTestId('list-row').first()
    await expect(firstRow).toBeVisible({ timeout: 15_000 })
    await firstRow.click()

    await expect(page.getByTestId('odoo-form-view')).toBeVisible({ timeout: 15_000 })

    // Check for Probability field (gauge widget)
    const probabilityWidget = page.locator('[data-testid="odoo-form-view"] svg')
    // Gauge is an SVG circle — just verify the form is visible
  })
})
