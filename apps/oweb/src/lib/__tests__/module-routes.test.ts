import { describe, expect, test } from 'vitest'
import {
  listPathForModel,
  modulePrefixFromXmlid,
  moduleRouteFromModel,
  recordPrefixForListPath,
  technicalModelFromActionPath,
} from '../module-routes'

describe('listPathForModel', () => {
  test('returns list path for known model', () => {
    expect(listPathForModel('hr.employee')).toBe('/hr/employees')
    expect(listPathForModel('crm.lead')).toBe('/crm/pipeline')
    expect(listPathForModel('res.partner')).toBe('/contacts/partners')
  })

  test('returns undefined for unknown model', () => {
    expect(listPathForModel('nonexistent.model')).toBeUndefined()
  })

  test('returns undefined for undefined input', () => {
    expect(listPathForModel(undefined)).toBeUndefined()
  })

  test('returns undefined for false input', () => {
    expect(listPathForModel(false)).toBeUndefined()
  })

  test('returns undefined for empty string', () => {
    expect(listPathForModel('')).toBeUndefined()
  })
})

describe('recordPrefixForListPath', () => {
  test('returns record prefix for known list path', () => {
    expect(recordPrefixForListPath('/hr/employees')).toBe('/hr/employee')
    expect(recordPrefixForListPath('/contacts/partners')).toBe('/contacts/partner')
  })

  test('returns undefined for unknown path', () => {
    expect(recordPrefixForListPath('/unknown/path')).toBeUndefined()
  })
})

describe('technicalModelFromActionPath', () => {
  test('returns model name for dotted string', () => {
    expect(technicalModelFromActionPath('hr.employee')).toBe('hr.employee')
    expect(technicalModelFromActionPath('crm.lead')).toBe('crm.lead')
    expect(technicalModelFromActionPath('parent.child.grandchild')).toBe('parent.child.grandchild')
  })

  test('returns undefined for non-dotted string', () => {
    expect(technicalModelFromActionPath('employees')).toBeUndefined()
    expect(technicalModelFromActionPath('')).toBeUndefined()
  })

  test('returns undefined for undefined input', () => {
    expect(technicalModelFromActionPath(undefined)).toBeUndefined()
  })

  test('returns undefined for false input', () => {
    expect(technicalModelFromActionPath(false)).toBeUndefined()
  })
})

describe('moduleRouteFromModel', () => {
  test('returns route spec for known model', () => {
    const route = moduleRouteFromModel('sale.order')
    expect(route?.listPath).toBe('/sale/orders')
    expect(route?.recordPrefix).toBe('/sale/order')
  })

  test('returns undefined for unknown model', () => {
    expect(moduleRouteFromModel('foo.bar')).toBeUndefined()
  })
})

describe('modulePrefixFromXmlid', () => {
  test('extracts module prefix from xmlid', () => {
    expect(modulePrefixFromXmlid('hr.open_view_employee_list')).toBe('hr')
    expect(modulePrefixFromXmlid('sale.menu_sale_order')).toBe('sale')
  })

  test('returns whole string if no dot', () => {
    expect(modulePrefixFromXmlid('noroot')).toBe('noroot')
  })

  test('returns undefined for undefined input', () => {
    expect(modulePrefixFromXmlid(undefined)).toBeUndefined()
  })

  test('returns undefined for empty string', () => {
    expect(modulePrefixFromXmlid('')).toBeUndefined()
  })
})
