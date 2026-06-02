import { expect, type Page } from '@playwright/test'

export interface E2ECredentials {
  db: string
  login: string
  password: string
}

export function getE2ECredentials(): E2ECredentials {
  const db = process.env.E2E_DB
  const login = process.env.E2E_LOGIN
  const password = process.env.E2E_PASSWORD

  if (!db || !login || !password) {
    throw new Error(
      'E2E credentials missing. Copy e2e/.env.example to e2e/.env.local, or export E2E_DB, E2E_LOGIN, E2E_PASSWORD.',
    )
  }

  return { db, login, password }
}

/** Log in via /login and wait for authenticated shell. */
export async function loginViaUi(page: Page, creds: E2ECredentials = getE2ECredentials()) {
  await page.goto('/login')
  await page.locator('#db').fill(creds.db)
  await page.locator('#login').fill(creds.login)
  await page.locator('#password').fill(creds.password)
  await page.getByTestId('login-submit').click()

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
  await expect(page.getByTestId('nav-settings')).toBeVisible({ timeout: 10_000 })
}
