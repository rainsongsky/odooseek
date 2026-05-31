import '@testing-library/jest-dom/vitest'
import { JSDOM } from 'jsdom'
import { vi } from 'vitest'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>')

if (!globalThis.DOMParser) {
  // @ts-expect-error DOMParser from jsdom window
  globalThis.DOMParser = dom.window.DOMParser
}

// Global pass-through: @odooseek/odoo-client resolves to real package.
// Individual tests override specific exports via vi.mock('@odooseek/odoo-client', ...).
vi.mock('@odooseek/odoo-client', async (original) => {
  const actual = await original() as Record<string, unknown>
  return actual
})
