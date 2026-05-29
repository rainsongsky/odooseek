/// <reference types="vitest" />
import { describe, expect, test, vi } from 'vitest'
import {
  type MenusData,
  type OdooMenuEntry,
  fetchMenus,
  flattenMenuItems,
  getAppSections,
  getApps,
  getMenu,
  getMenuAsTree,
  searchMenus,
} from '../menu-service'

const MOCK_MENUS: MenusData = {
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
    backgroundImage: null,
  },
  '1': {
    id: 1,
    name: 'CRM',
    children: [10, 11],
    appID: false,
    xmlid: 'crm.menu_root',
    actionID: 100,
    actionModel: 'ir.actions.act_window',
    actionPath: 'crm.lead',
    webIcon: 'crm,static/description/icon.png',
    webIconData: null,
  },
  '2': {
    id: 2,
    name: 'Sales',
    children: [20, 21],
    appID: false,
    xmlid: 'sale.menu_root',
    actionID: 200,
    actionModel: 'ir.actions.act_window',
    actionPath: 'sale.order',
    webIcon: 'sale,static/description/icon.png',
    webIconData: null,
  },
  '10': {
    id: 10,
    name: 'Pipeline',
    children: [],
    appID: 1,
    xmlid: 'crm.menu_crm_leads',
    actionID: 101,
    actionModel: 'ir.actions.act_window',
    actionPath: 'crm.lead',
    webIcon: null,
    webIconData: null,
  },
  '11': {
    id: 11,
    name: 'Contacts',
    children: [],
    appID: 1,
    xmlid: 'crm.menu_contacts',
    actionID: 102,
    actionModel: 'ir.actions.act_window',
    actionPath: 'res.partner',
    webIcon: null,
    webIconData: null,
  },
  '20': {
    id: 20,
    name: 'Orders',
    children: [200],
    appID: 2,
    xmlid: 'sale.menu_sale_order',
    actionID: false,
    actionModel: false,
    actionPath: false,
    webIcon: null,
    webIconData: null,
  },
  '21': {
    id: 21,
    name: 'Customers',
    children: [],
    appID: 2,
    xmlid: 'sale.menu_customers',
    actionID: 201,
    actionModel: 'ir.actions.act_window',
    actionPath: 'res.partner',
    webIcon: null,
    webIconData: null,
  },
  '200': {
    id: 200,
    name: 'Quotations',
    children: [],
    appID: 2,
    xmlid: 'sale.menu_sale_quotations',
    actionID: 202,
    actionModel: 'ir.actions.act_window',
    actionPath: 'sale.order',
    webIcon: null,
    webIconData: null,
  },
}

describe('menu-service', () => {
  describe('fetchMenus', () => {
    test('fetches /api/menus and returns data', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(MOCK_MENUS),
      })
      globalThis.fetch = mockFetch

      const result = await fetchMenus()
      expect(result).toEqual(MOCK_MENUS)
      expect(mockFetch).toHaveBeenCalledWith('/api/menus', { credentials: 'include' })
    })

    test('throws on non-ok response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false })
      await expect(fetchMenus()).rejects.toThrow('Failed to load menus')
    })
  })

  describe('getApps', () => {
    test('returns root children as app entries', () => {
      const apps = getApps(MOCK_MENUS)
      expect(apps).toHaveLength(2)
      expect(apps[0].name).toBe('CRM')
      expect(apps[1].name).toBe('Sales')
    })

    test('returns empty for missing root', () => {
      expect(getApps({} as MenusData)).toEqual([])
    })
  })

  describe('getMenu', () => {
    test('returns menu by id', () => {
      expect(getMenu(MOCK_MENUS, 1)?.name).toBe('CRM')
    })

    test('returns null for missing id', () => {
      expect(getMenu(MOCK_MENUS, 999)).toBeNull()
    })
  })

  describe('getMenuAsTree', () => {
    test('builds tree with children', () => {
      const tree = getMenuAsTree(MOCK_MENUS, 1)
      expect(tree.id).toBe(1)
      expect(tree.name).toBe('CRM')
      expect(tree.children).toHaveLength(2)
      expect(tree.children[0].name).toBe('Pipeline')
      expect(tree.isLeaf).toBe(false)
    })

    test('leaf node has no children and isLeaf=true', () => {
      const tree = getMenuAsTree(MOCK_MENUS, 10)
      expect(tree.isLeaf).toBe(true)
      expect(tree.children).toEqual([])
    })

    test('returns empty node for missing id', () => {
      const tree = getMenuAsTree(MOCK_MENUS, 999)
      expect(tree.id).toBe(0)
      expect(tree.isLeaf).toBe(true)
    })

    test('nested tree: Sales > Orders > Quotations', () => {
      const tree = getMenuAsTree(MOCK_MENUS, 2)
      expect(tree.children).toHaveLength(2)
      const orders = tree.children.find((c) => c.id === 20)
      expect(orders?.children).toHaveLength(1)
      expect(orders?.children[0].name).toBe('Quotations')
    })
  })

  describe('getAppSections', () => {
    test('returns direct children of an app', () => {
      const sections = getAppSections(MOCK_MENUS, 1)
      expect(sections).toHaveLength(2)
      expect(sections[0].name).toBe('Pipeline')
      expect(sections[1].name).toBe('Contacts')
    })
  })

  describe('flattenMenuItems', () => {
    test('flattens all actionable items with paths', () => {
      const items = flattenMenuItems(MOCK_MENUS, 1)
      expect(items).toHaveLength(3)
      expect(items[0].menu.name).toBe('CRM')
      expect(items[0].path).toEqual(['CRM'])
      expect(items[1].menu.name).toBe('Pipeline')
      expect(items[1].path).toEqual(['CRM', 'Pipeline'])
      expect(items[2].path).toEqual(['CRM', 'Contacts'])
    })

    test('includes deeply nested items', () => {
      const items = flattenMenuItems(MOCK_MENUS, 2)
      expect(items).toHaveLength(3)
      const quotItem = items.find((i) => i.menu.name === 'Quotations')
      expect(quotItem?.path).toEqual(['Sales', 'Orders', 'Quotations'])
    })

    test('skips items without actionID', () => {
      const items = flattenMenuItems(MOCK_MENUS, 2)
      const ordersItem = items.find((i) => i.menu.name === 'Orders')
      expect(ordersItem).toBeUndefined()
    })
  })

  describe('searchMenus', () => {
    test('finds items by name', () => {
      const results = searchMenus(MOCK_MENUS, 'Pipeline')
      expect(results).toHaveLength(1)
      expect(results[0].menu.name).toBe('Pipeline')
    })

    test('finds items by path segment', () => {
      const results = searchMenus(MOCK_MENUS, 'CRM')
      expect(results.length).toBeGreaterThanOrEqual(2)
    })

    test('returns empty for no query', () => {
      expect(searchMenus(MOCK_MENUS, '')).toEqual([])
      expect(searchMenus(MOCK_MENUS, '  ')).toEqual([])
    })

    test('is case-insensitive', () => {
      const results = searchMenus(MOCK_MENUS, 'pipeline')
      expect(results).toHaveLength(1)
    })
  })
})
