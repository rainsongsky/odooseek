export interface OdooMenuEntry {
  id: number | 'root'
  name: string
  children: number[]
  appID: number | false
  xmlid: string
  actionID: number | false
  actionModel: string | false
  actionPath: string | false
  webIcon: string | null
  webIconData: string | null
}

export interface MenusData {
  root: OdooMenuEntry & { backgroundImage?: string | null }
  [menuId: string]: OdooMenuEntry & { backgroundImage?: string | null }
}

export interface MenuTreeNode {
  id: number
  name: string
  children: MenuTreeNode[]
  appID: number | false
  xmlid: string
  actionID: number | false
  actionModel: string | false
  actionPath: string | false
  webIcon: string | null
  webIconData: string | null
  isLeaf: boolean
}

export async function fetchMenus(): Promise<MenusData> {
  const res = await fetch('/api/menus', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to load menus')
  return res.json()
}

export function getApps(menus: MenusData): OdooMenuEntry[] {
  const root = menus.root
  if (!root) return []
  return [...new Set(root.children)]
    .map((id) => menus[String(id)])
    .filter((m): m is OdooMenuEntry => !!m)
}

export function getMenu(menus: MenusData, menuId: number): OdooMenuEntry | null {
  return menus[String(menuId)] ?? null
}

export function getMenuAsTree(menus: MenusData, menuId: number | 'root'): MenuTreeNode {
  const entry = menus[String(menuId)]
  if (!entry) {
    return {
      id: 0,
      name: '',
      children: [],
      appID: false,
      xmlid: '',
      actionID: false,
      actionModel: false,
      actionPath: false,
      webIcon: null,
      webIconData: null,
      isLeaf: true,
    }
  }
  return {
    id: entry.id as number,
    name: entry.name,
    children: [...new Set(entry.children)].map((cid) => getMenuAsTree(menus, cid)),
    appID: entry.appID,
    xmlid: entry.xmlid,
    actionID: entry.actionID,
    actionModel: entry.actionModel,
    actionPath: entry.actionPath,
    webIcon: entry.webIcon,
    webIconData: entry.webIconData,
    isLeaf: entry.children.length === 0,
  }
}

export function getAppSections(menus: MenusData, appId: number): MenuTreeNode[] {
  const appTree = getMenuAsTree(menus, appId)
  return appTree.children
}

export function flattenMenuItems(
  menus: MenusData,
  rootId: number | 'root',
): Array<{ menu: OdooMenuEntry; path: string[] }> {
  const result: Array<{ menu: OdooMenuEntry; path: string[] }> = []
  const visit = (id: number | 'root', path: string[]) => {
    const entry = menus[String(id)]
    if (!entry) return
    const newPath = [...path, entry.name]
    if (entry.actionID && entry.id !== 'root') {
      result.push({ menu: entry, path: newPath })
    }
    for (const cid of entry.children) {
      visit(cid, newPath)
    }
  }
  visit(rootId, [])
  return result
}

export function searchMenus(
  menus: MenusData,
  query: string,
): Array<{ menu: OdooMenuEntry; path: string[] }> {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const all = flattenMenuItems(menus, 'root')
  return all.filter(({ menu, path }) => {
    const fullPath = path.join(' / ').toLowerCase()
    return fullPath.includes(q) || menu.name.toLowerCase().includes(q)
  })
}
