import { expect, test } from '@playwright/test'
import { getE2ECredentials, loginViaUi } from './fixtures/auth'

/** HR Configuration dedicated routes (refs #175). */
test.describe('HR configuration routes', () => {
  test.beforeEach(async ({ page }) => {
    getE2ECredentials()
    await loginViaUi(page)
  })

  test('direct configuration routes load views', async ({ page }) => {
    for (const path of ['/hr/jobs', '/hr/work-locations', '/hr/plans'] as const) {
      await page.goto(path)
      await expect(page).toHaveURL(path)
      await expect(
        page.getByTestId('odoo-list-view').or(page.getByTestId('odoo-form-view')),
      ).toBeVisible({ timeout: 30_000 })
    }
  })
})
