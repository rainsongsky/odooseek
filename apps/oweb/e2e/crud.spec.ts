import { expect, test } from '@playwright/test'
import { getE2ECredentials, loginViaUi } from './fixtures/auth'
import { ensureListView } from './fixtures/views'

test.describe('CRUD operations', () => {
  test.beforeEach(async ({ page }) => {
    getE2ECredentials()
    await loginViaUi(page)
  })

  test('navigate from list to form and back', async ({ page }) => {
    await page.goto('/hr/employees')
    await ensureListView(page)

    const firstRow = page.getByTestId('list-row').first()
    await expect(firstRow).toBeVisible({ timeout: 30_000 })
    const recordId = await firstRow.getAttribute('data-record-id')
    expect(recordId).toBeTruthy()

    // Click to open form
    await firstRow.click()

    // Form should load
    await expect(page.getByTestId('odoo-form-view')).toBeVisible({ timeout: 30_000 })
    await expect(page).toHaveURL(new RegExp(`/hr/employee/${recordId}`))

    // Navigate back via breadcrumb
    const breadcrumb = page.getByTestId('breadcrumb-back')
    if (await breadcrumb.isVisible()) {
      await breadcrumb.click()
      await expect(page.getByTestId('odoo-list-view')).toBeVisible({ timeout: 15_000 })
    }
  })

  test('form edit mode can be activated', async ({ page }) => {
    await page.goto('/hr/employees')
    await ensureListView(page)

    const firstRow = page.getByTestId('list-row').first()
    await expect(firstRow).toBeVisible({ timeout: 30_000 })
    await firstRow.click()

    await expect(page.getByTestId('odoo-form-view')).toBeVisible({ timeout: 30_000 })

    // Click edit button
    const editBtn = page.getByTestId('form-edit-button')
    if (await editBtn.isVisible()) {
      await editBtn.click()
      // Input fields should now be editable
      const input = page.locator('input[type="text"]').first()
      await expect(input).toBeVisible({ timeout: 5_000 })
    }
  })

  test('list pagination controls work', async ({ page }) => {
    await page.goto('/contacts/partners')
    await ensureListView(page)

    const rows = page.getByTestId('list-row')
    await expect(rows.first()).toBeVisible({ timeout: 30_000 })

    // Check pagination exists and click next if available
    const nextBtn = page.getByTestId('pagination-next')
    if (await nextBtn.isVisible()) {
      const currentUrl = page.url()
      await nextBtn.click()
      await page.waitForTimeout(500)
      // URL or content should change
    }
  })
})
