import type { MenusData } from '@odooseek/odoo-client'
import { describe, expect, test } from 'vitest'
import {
  buildActionRouteIndex,
  isMenuEntryActive,
  resolveByActionPath,
  resolveByXmlid,
  resolveMenuRoute,
} from '../menu-navigation'

describe('resolveByXmlid', () => {
  test('HR payroll employees', () => {
    expect(resolveByXmlid('hr.menu_hr_employee_payroll')?.kind).toBe('module')
    expect(resolveByXmlid('hr.menu_hr_employee_payroll')).toMatchObject({ to: '/hr/employees' })
  })

  test('HR directory menu_hr_employee without payroll substring false positive', () => {
    const route = resolveByXmlid('hr.menu_hr_employee')
    expect(route).toMatchObject({ to: '/hr/directory' })
  })

  test('CRM pipeline', () => {
    expect(resolveByXmlid('crm.menu_crm_opportunities')).toMatchObject({ to: '/crm/pipeline' })
  })
})

describe('resolveByActionPath', () => {
  test('Odoo 19 slug employees under hr', () => {
    expect(resolveByActionPath('hr.menu_hr_root', 'employees')).toMatchObject({
      to: '/hr/employees',
    })
  })

  test('technical model sale.order', () => {
    expect(resolveByActionPath('sale.menu_sale_order', 'sale.order')).toMatchObject({
      to: '/sale/orders',
    })
  })
})

describe('resolveMenuRoute', () => {
  test('same actionID via index — not menu name', () => {
    const menus = {
      root: {
        id: 'root',
        name: 'root',
        children: [1, 2],
        appID: false,
        xmlid: '',
        actionID: false,
        actionModel: false,
        actionPath: false,
        webIcon: null,
        webIconData: null,
      },
      '1': {
        id: 1,
        name: '员工',
        children: [],
        appID: false,
        xmlid: 'hr.menu_hr_employee_payroll',
        actionID: 472,
        actionModel: false,
        actionPath: 'employees',
        webIcon: null,
        webIconData: null,
      },
      '2': {
        id: 2,
        name: '员工',
        children: [],
        appID: false,
        xmlid: 'hr.menu_config_employee',
        actionID: 999,
        actionModel: false,
        actionPath: false,
        webIcon: null,
        webIconData: null,
      },
    } as MenusData

    const payroll = resolveMenuRoute({ name: '员工', xmlid: 'hr.menu_hr_employee_payroll', actionID: 472 }, menus)
    expect(payroll).toMatchObject({ kind: 'module', to: '/hr/employees' })

    const idx = buildActionRouteIndex(menus)
    expect(idx.get(472)).toMatchObject({ to: '/hr/employees' })
    expect(idx.get(999)?.kind).toBe('web')
  })

  test('unknown action without resModel falls back to web', () => {
    expect(resolveMenuRoute({ actionID: 504 })).toMatchObject({ kind: 'web', action: 504 })
  })

  test('res.partner via resModel routes to contacts', () => {
    expect(
      resolveMenuRoute({
        actionID: 504,
        xmlid: 'contacts.res_partner_menu_contacts',
        resModel: 'res.partner',
      }),
    ).toMatchObject({ kind: 'module', to: '/contacts/partners' })
  })

  test('actionPath res.partner routes without BFF field', () => {
    expect(
      resolveMenuRoute({ actionID: 201, actionPath: 'res.partner', xmlid: 'sale.menu_customers' }),
    ).toMatchObject({ kind: 'module', to: '/contacts/partners' })
  })
})

describe('isMenuEntryActive', () => {
  test('highlights module list path', () => {
    expect(
      isMenuEntryActive(
        { xmlid: 'hr.menu_hr_employee_payroll', actionID: 472 },
        '/hr/employees',
        {},
      ),
    ).toBe(true)
  })

  test('highlights record deep link', () => {
    expect(
      isMenuEntryActive(
        { xmlid: 'hr.menu_hr_employee_payroll', actionID: 472 },
        '/hr/employee/6',
        {},
      ),
    ).toBe(true)
  })

  test('highlights contacts module path', () => {
    expect(
      isMenuEntryActive(
        {
          actionID: 504,
          xmlid: 'contacts.res_partner_menu_contacts',
          resModel: 'res.partner',
        },
        '/contacts/partners',
        {},
      ),
    ).toBe(true)
  })

  test('highlights web action URL when still on /web', () => {
    expect(
      isMenuEntryActive({ actionID: 504, xmlid: 'contacts.res_partner_menu_contacts' }, '/web', {
        action: 504,
      }),
    ).toBe(true)
  })
})
