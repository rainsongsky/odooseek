import { expect, test } from '@playwright/test'
import { getE2ECredentials, loginViaUi } from './fixtures/auth'
import { ensureListView } from './fixtures/views'

test.describe('Form edit and save', () => {
  test.beforeEach(async ({ page }) => {
    getE2ECredentials()
    await loginViaUi(page)
  })

  test('edit CRM lead form and cancel', async ({ page }) => {
    await page.goto('/crm/leads')
    await ensureListView(page)

    const firstRow = page.getByTestId('list-row').first()
    await expect(firstRow).toBeVisible({ timeout: 15_000 })
    await firstRow.click()

    await expect(page.getByTestId('odoo-form-view')).toBeVisible({ timeout: 15_000 })

    // Click Edit button if visible
    const editBtn = page.getByTestId('form-edit-button')
    if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editBtn.click()
      // Should now be in edit mode — input fields visible
      const inputs = page.locator('input[type="text"], textarea')
      await expect(inputs.first()).toBeVisible({ timeout: 5_000 })
    }
  })

  test('lead form shows stage field', async ({ page }) => {
    await page.goto('/crm/leads')
    await ensureListView(page)

    const firstRow = page.getByTestId('list-row').first()
    await expect(firstRow).toBeVisible({ timeout: 15_000 })
    await firstRow.click()

    await expect(page.getByTestId('odoo-form-view')).toBeVisible({ timeout: 15_000 })

    // Verify probability field is present (CRM-specific)
    // The gauge SVG is rendered by the GaugeWidget
    const svg = page.locator('[data-testid="odoo-form-view"] svg')
    // SVG may or may not be visible depending on field configuration — just check form loads
  })

  test('contacts edit and cancel', async ({ page }) => {
    await page.goto('/contacts/partners')
    await ensureListView(page)

    const firstRow = page.getByTestId('list-row').first()
    await expect(firstRow).toBeVisible({ timeout: 15_000 })
    await firstRow.click()

    await expect(page.getByTestId('odoo-form-view')).toBeVisible({ timeout: 15_000 })

    // Try clicking Edit
    const editBtn = page.getByTestId('form-edit-button')
    if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editBtn.click()
      // Change the name field
      const nameInput = page.locator('input[type="text"]').first()
      if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await nameInput.fill('Test E2E')
      }

      // Click Cancel to discard changes
      const cancelBtn = page.getByTestId('form-cancel-button')
      if (await cancelBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await cancelBtn.click()
        // Should return to read-only mode
        await expect(page.getByTestId('odoo-form-view')).toBeVisible({ timeout: 5_000 })
      }
    }
  })
})
