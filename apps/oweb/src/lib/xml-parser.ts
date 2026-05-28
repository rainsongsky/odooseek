import type {
  FieldElement,
  FormElement,
  KanbanTemplateNode,
  ParsedFormView,
  ParsedKanbanView,
  ParsedListView,
  ParsedSearchView,
  SearchFilter,
  ViewField,
} from './odoo-types'

function parseFieldElement(el: Element): FieldElement {
  return {
    type: 'field',
    name: el.getAttribute('name') ?? '',
    widget: el.getAttribute('widget') ?? undefined,
    string: el.getAttribute('string') ?? undefined,
    invisible: el.getAttribute('invisible') ? Number(el.getAttribute('invisible')) : undefined,
    required: el.hasAttribute('required'),
    readonly: el.hasAttribute('readonly'),
    nolabel: el.hasAttribute('nolabel'),
    placeholder: el.getAttribute('placeholder') ?? undefined,
    options: el.getAttribute('options')
      ? parseOptions(el.getAttribute('options') ?? '')
      : undefined,
  }
}

function parseOptions(attrs: string): Record<string, unknown> {
  try {
    return JSON.parse(attrs.replace(/'/g, '"'))
  } catch {
    return {}
  }
}

function parseChildren(parent: Element, tag: string): Element[] {
  return Array.from(parent.children).filter((c) => c.tagName === tag)
}

function parseFormElements(container: Element): FormElement[] {
  const elements: FormElement[] = []

  for (const child of Array.from(container.children)) {
    const tag = child.tagName

    if (tag === 'field') {
      elements.push(parseFieldElement(child))
    } else if (tag === 'sheet') {
      elements.push({
        type: 'sheet',
        elements: parseFormElements(child),
      })
    } else if (tag === 'group') {
      const col = Number(child.getAttribute('col') ?? 2)
      elements.push({
        type: 'group',
        string: child.getAttribute('string') ?? undefined,
        col,
        elements: parseFormElements(child),
      })
    } else if (tag === 'notebook') {
      const pages = parseChildren(child, 'page').map((page) => ({
        string: page.getAttribute('string') ?? '',
        elements: parseFormElements(page),
      }))
      elements.push({ type: 'notebook', pages })
    } else if (tag === 'separator') {
      elements.push({
        type: 'separator',
        string: child.getAttribute('string') ?? undefined,
      })
    } else if (tag === 'newline') {
      elements.push({ type: 'newline' })
    } else if (tag === 'label') {
      elements.push({
        type: 'label',
        string: child.getAttribute('string') ?? '',
      })
    }
  }

  return elements
}

/** Parse Odoo <list> XML → ParsedListView */
export function parseListXml(xml: string): ParsedListView {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const root = doc.documentElement

  return {
    type: 'list',
    string: root.getAttribute('string') ?? '',
    editable: root.getAttribute('editable') ?? undefined,
    create: root.getAttribute('create') !== 'false',
    delete: root.getAttribute('delete') !== 'false',
    columns: Array.from(root.querySelectorAll('field')).map((el) => ({
      name: el.getAttribute('name') ?? '',
      string: el.getAttribute('string') ?? undefined,
      widget: el.getAttribute('widget') ?? undefined,
      invisible: el.getAttribute('invisible') ? Number(el.getAttribute('invisible')) : undefined,
      sum: el.getAttribute('sum') ?? undefined,
      readonly: el.hasAttribute('readonly'),
      required: el.hasAttribute('required'),
      decoration_bf: el.getAttribute('decoration-bf') ?? undefined,
      decoration_it: el.getAttribute('decoration-it') ?? undefined,
    })),
  }
}

/** Parse Odoo <form> XML → ParsedFormView */
export function parseFormXml(xml: string): ParsedFormView {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const root = doc.documentElement

  return {
    type: 'form',
    string: root.getAttribute('string') ?? '',
    elements: parseFormElements(root),
  }
}

/** Parse Odoo <kanban> XML → ParsedKanbanView */
export function parseKanbanXml(xml: string): ParsedKanbanView {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const root = doc.documentElement

  const fieldEls = root.querySelectorAll('field')
  const fields = Array.from(fieldEls).map((el) => el.getAttribute('name') ?? '')

  const defaultGroupBy = root.getAttribute('default_group_by') ?? undefined
  const highlightColor = root.getAttribute('highlight_color') ?? undefined
  const template = root.querySelector('template')?.textContent ?? ''
  const qweb = root.querySelector('templates')?.textContent ?? ''

  const rawTemplate = template || qweb
  const templateNodes = rawTemplate ? parseKanbanTemplate(rawTemplate) : undefined

  return {
    type: 'kanban',
    string: root.getAttribute('string') ?? '',
    fields,
    template: rawTemplate,
    templateNodes,
    defaultGroupBy,
    highlightColor,
  }
}

/** Extract <field> elements from a kanban card template */
export function parseKanbanFields(templateXml: string): ViewField[] {
  const doc = new DOMParser().parseFromString(templateXml, 'text/xml')
  return Array.from(doc.querySelectorAll('field')).map((el) => ({
    name: el.getAttribute('name') ?? '',
    string: el.getAttribute('string') ?? undefined,
    widget: el.getAttribute('widget') ?? undefined,
    invisible: el.getAttribute('invisible') ? Number(el.getAttribute('invisible')) : undefined,
    readonly: el.hasAttribute('readonly'),
  }))
}

// ── Phase 4: QWeb template AST parser ─────────────────────────

/** Parse kanban card template XML → KanbanTemplateNode[] AST */
export function parseKanbanTemplate(templateXml: string): KanbanTemplateNode[] {
  const doc = new DOMParser().parseFromString(templateXml, 'text/xml')
  const root = doc.documentElement
  const nodes = parseChildNodes(root)
  return mergeConditionChains(nodes)
}

/** Recursively parse child nodes of an element */
function parseChildNodes(el: Element): KanbanTemplateNode[] {
  const result: KanbanTemplateNode[] = []
  for (const child of el.childNodes) {
    const node = parseNode(child)
    if (node) result.push(node)
  }
  return result
}

const HTML_TAGS = new Set([
  'div', 'span', 'a', 'p', 'strong', 'em', 'b', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'section', 'header', 'table', 'tr', 'td', 'th', 'br', 'hr', 'img', 't',
])

function parseNode(node: ChildNode): KanbanTemplateNode | null {
  if (node.nodeType === 3) {
    // Text node
    const content = node.textContent?.replace(/\s+/g, ' ').trim()
    if (!content) return null
    return { type: 'text', content }
  }
  if (node.nodeType !== 1) return null

  const el = node as Element
  const tag = el.tagName.toLowerCase()

  // <field> elements
  if (tag === 'field') {
    return {
      type: 'field',
      name: el.getAttribute('name') ?? '',
      widget: el.getAttribute('widget') ?? undefined,
      class: el.getAttribute('class') ?? undefined,
    }
  }

  // Skip <widget> for now
  if (tag === 'widget') return null

  // QWeb directives
  const tIf = el.getAttribute('t-if')
  const tElif = el.getAttribute('t-elif')
  const tElse = el.hasAttribute('t-else')
  const tForeach = el.getAttribute('t-foreach')
  const tAs = el.getAttribute('t-as')
  const tOut = el.getAttribute('t-out')

  if (tForeach && tAs) {
    return {
      type: 'loop',
      foreach: tForeach,
      as: tAs,
      children: parseChildNodes(el),
    }
  }

  if (tIf) {
    return {
      type: 'condition',
      if: tIf,
      children: parseChildNodes(el),
    }
  }

  if (tElif) {
    return {
      type: 'condition',
      elif: tElif,
      children: parseChildNodes(el),
    }
  }

  if (tElse) {
    return {
      type: 'condition',
      else: '',
      children: parseChildNodes(el),
    }
  }

  if (tOut) {
    return {
      type: 'output',
      expr: tOut,
      widget: el.getAttribute('t-options-widget') ?? undefined,
    }
  }

  // <footer> special handling
  if (tag === 'footer') {
    return { type: 'footer', children: parseChildNodes(el) }
  }

  // HTML wrapper elements
  if (HTML_TAGS.has(tag)) {
    return {
      type: 'html',
      tag,
      class: el.getAttribute('class') ?? undefined,
      children: parseChildNodes(el),
    }
  }

  // Unknown: recurse into children (skip the wrapper)
  return null
}

/** Merge adjacent condition nodes (t-elif/t-else) into a chain */
function mergeConditionChains(nodes: KanbanTemplateNode[]): KanbanTemplateNode[] {
  const result: KanbanTemplateNode[] = []
  for (const node of nodes) {
    if (node.type === 'condition' && (node.elif || node.else) && result.length > 0) {
      const last = result[result.length - 1]
      if (last?.type === 'condition' && last.if) {
        // Append as elif/else to the previous if-condition
        last.children.push(node)
        continue
      }
    }
    result.push(node)
  }
  return result
}

/** Parse Odoo <search> XML → ParsedSearchView */
export function parseSearchXml(xml: string): ParsedSearchView {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  const root = doc.documentElement

  const searchFields: ViewField[] = Array.from(root.querySelectorAll('field')).map((el) => {
    const filterDomainRaw = el.getAttribute('filter_domain')
    return {
      name: el.getAttribute('name') ?? '',
      string: el.getAttribute('string') ?? undefined,
      operator: el.getAttribute('operator') ?? 'ilike',
      filter_domain: filterDomainRaw ? JSON.parse(filterDomainRaw.replace(/'/g, '"')) : undefined,
    }
  })

  const filters: SearchFilter[] = Array.from(root.querySelectorAll('filter, separator')).map(
    (el) => {
      const domainRaw = el.getAttribute('domain')
      return {
        name: el.getAttribute('name') ?? '',
        string: el.getAttribute('string') ?? '',
        domain: domainRaw ? JSON.parse(domainRaw.replace(/'/g, '"')) : [],
        help: el.getAttribute('help') ?? undefined,
        context: el.getAttribute('context') ?? undefined,
      }
    },
  )

  return { type: 'search', fields: searchFields, filters }
}
