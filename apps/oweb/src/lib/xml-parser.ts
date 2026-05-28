import type {
  FieldElement,
  FormElement,
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

  const template = root.querySelector('template')?.textContent ?? ''
  const qweb = root.querySelector('templates')?.textContent ?? ''

  return {
    type: 'kanban',
    string: root.getAttribute('string') ?? '',
    fields,
    template: template || qweb,
  }
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
