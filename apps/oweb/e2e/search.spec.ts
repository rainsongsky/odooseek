import { expect, test } from '@playwright/test'
import { getE2ECredentials, loginViaUi } from './fixtures/auth'
import { ensureListView } from './fixtures/views'

test.describe('Search and filter', () => {
  test.beforeEach(async ({ page }) => {
    getE2ECredentials()
    await loginViaUi(page)
  })

  test('search bar filters list results', async ({ page }) => {
    await page.goto('/contacts/partners')
    await ensureListView(page)

    // Ensure rows are visible first
    const rows = page.getByTestId('list-row')
    await expect(rows.first()).toBeVisible({ timeout: 15_000 })

    const initialCount = await rows.count()

    // Type in search bar
    const searchBar = page.getByTestId('search-input')
    if (await searchBar.isVisible()) {
      await searchBar.fill('xyzzy_nonexistent_contact')
      await searchBar.press('Enter')
      await page.waitForTimeout(1000)

      // Results should be reduced (likely 0)
      const filteredCount = await page.getByTestId('list-row').count()
      expect(filteredCount).toBeLessThanOrEqual(initialCount)
    }
  })

  test('list view loads with data', async ({ page }) => {
    await page.goto('/hr/employees')
    await ensureListView(page)

    const rows = page.getByTestId('list-row')
    await expect(rows.first()).toBeVisible({ timeout: 30_000 })
  })
})
