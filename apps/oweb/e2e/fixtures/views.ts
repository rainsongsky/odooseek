import { expect, type Page } from '@playwright/test'

/** HR employees defaults to kanban — switch to list before list-row assertions. */
export async function ensureListView(page: Page) {
  const listView = page.getByTestId('odoo-list-view')
  if (await listView.isVisible()) return

  await page.getByTestId('view-switch-list').click()
  await expect(listView).toBeVisible({ timeout: 30_000 })
}

/** App menu tile for HR / Employees (Odoo zh_CN: 员工). */
export function hrAppTile(page: Page) {
  return page.getByTestId('app-tile').filter({
    hasText: /员工|employees|human resources|hr/i,
  })
}
