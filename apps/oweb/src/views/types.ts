// Odoo 19 CE view type definitions

export interface OdooFieldMeta {
  name: string
  type: string // char, text, integer, float, boolean, date, datetime, selection, many2one, many2many, one2many, binary, html, reference, monetary
  string: string // display label
  required: boolean
  readonly: boolean
  relation?: string
  domain?: unknown
  selection?: [string, string][]
  help?: string
  store: boolean
  searchable: boolean
  sortable: boolean
  widget?: string
}

export interface ViewField {
  name: string
  string?: string
  type?: string
  widget?: string
  options?: Record<string, unknown>
  invisible?: number
  required?: boolean
  readonly?: boolean
  nolabel?: boolean
  placeholder?: string
  sum?: string
  operator?: string
  filter_domain?: unknown
  decoration_bf?: string
  decoration_it?: string
}

export interface ParsedListView {
  type: 'list'
  string: string
  editable?: string
  create?: boolean
  delete?: boolean
  columns: ViewField[]
}

export interface ParsedFormView {
  type: 'form'
  string: string
  elements: FormElement[]
}

export type FormElement =
  | SheetElement
  | GroupElement
  | NotebookElement
  | FieldElement
  | SeparatorElement
  | NewlineElement
  | LabelElement

export interface SheetElement {
  type: 'sheet'
  elements: FormElement[]
}

export interface GroupElement {
  type: 'group'
  string?: string
  col?: number
  elements: FormElement[]
}

export interface NotebookElement {
  type: 'notebook'
  pages: { string: string; elements: FormElement[] }[]
}

export interface FieldElement {
  type: 'field'
  name: string
  widget?: string
  string?: string
  options?: Record<string, unknown>
  invisible?: number
  required?: boolean
  readonly?: boolean
  nolabel?: boolean
  placeholder?: string
}

export interface SeparatorElement {
  type: 'separator'
  string?: string
}

export interface NewlineElement {
  type: 'newline'
}

export interface LabelElement {
  type: 'label'
  string: string
}

export interface ParsedKanbanView {
  type: 'kanban'
  string: string
  fields: string[]
  template: string // raw template HTML
}

export interface ParsedSearchView {
  type: 'search'
  fields: ViewField[]
  filters: SearchFilter[]
}

export interface SearchFilter {
  name: string
  string: string
  domain: unknown[]
  help?: string
  context?: string
}
