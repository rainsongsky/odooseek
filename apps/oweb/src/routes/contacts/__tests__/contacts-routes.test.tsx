import { describe, expect, test, vi } from 'vitest'
import { resolveMenuRoute } from '../../../lib/menu-navigation'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: unknown) => opts,
  redirect: (opts: unknown) => opts,
}))

describe('contacts routes', () => {
  test('contacts menu resolves to partners list', () => {
    expect(
      resolveMenuRoute({
        actionID: 504,
        xmlid: 'contacts.res_partner_menu_contacts',
        actionPath: 'contacts',
        resModel: 'res.partner',
      }),
    ).toMatchObject({ kind: 'module', to: '/contacts/partners', recordPrefix: '/contacts/partner' })
  })
})
