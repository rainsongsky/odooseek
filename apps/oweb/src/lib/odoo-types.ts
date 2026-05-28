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
  decoration_danger?: string
  decoration_warning?: string
  decoration_success?: string
  decoration_info?: string
  decoration_muted?: string
}

export interface ParsedListView {
  type: 'list'
  string: string
  editable?: string
  create?: boolean
  delete?: boolean
  columns: ViewField[]
  decorations: Record<string, string>
}

export interface ParsedFormView {
  type: 'form'
  string: string
  elements: FormElement[]
}

export type FormElement =
  | HeaderElement
  | SheetElement
  | GroupElement
  | NotebookElement
  | FieldElement
  | ButtonElement
  | SeparatorElement
  | NewlineElement
  | LabelElement

export interface HeaderElement {
  type: 'header'
  buttons: ButtonElement[]
}

export interface ButtonElement {
  type: 'button'
  name: string
  string?: string
  buttonType?: 'object' | 'action' | 'edit'
  class?: string
  icon?: string
  invisible?: string
  states?: string
  confirm?: string
}

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
  templateNodes?: KanbanTemplateNode[] // AST (Phase 4)
  defaultGroupBy?: string
  highlightColor?: string // e.g. "color"
}

// ── Phase 4: QWeb template AST ───────────────────────────────

export type KanbanTemplateNode =
  | { type: 'field'; name: string; widget?: string; class?: string }
  | { type: 'condition'; if?: string; elif?: string; else?: string; children: KanbanTemplateNode[] }
  | { type: 'loop'; foreach: string; as: string; children: KanbanTemplateNode[] }
  | { type: 'output'; expr: string; widget?: string }
  | { type: 'html'; tag: string; class?: string; children: KanbanTemplateNode[] }
  | { type: 'text'; content: string }
  | { type: 'footer'; children: KanbanTemplateNode[] }

export interface ParsedSearchView {
  type: 'search'
  fields: ViewField[]
  filters: SearchFilter[]
  groupByFilters: SearchGroupBy[]
}

export interface SearchFilter {
  name: string
  string: string
  domain: unknown[]
  help?: string
  context?: string
}

export interface SearchGroupBy {
  name: string
  string: string
  fieldName: string
  interval?: string
}

export interface ReadGroupResult {
  __domain: unknown[]
  __context: unknown
  [key: string]: unknown // grouped field values + _count suffixed fields
}

export interface ParsedPivotView {
  type: 'pivot'
  string: string
  disableLinking?: boolean
  defaultOrder?: string
  rowFields: PivotField[]
  colFields: PivotField[]
  measures: PivotMeasure[]
}

export interface PivotField {
  name: string
  string?: string
  interval?: string // day, week, month, quarter, year
}

export interface PivotMeasure {
  name: string
  string?: string
  operator?: string // sum, avg, count
}

export interface GraphField {
  name: string
  string?: string
  interval?: string
}

export interface GraphMeasure {
  name: string
  string?: string
  operator?: string
}

export interface ParsedGraphView {
  type: 'graph'
  string: string
  graphType: 'bar' | 'line' | 'pie'
  rowFields: GraphField[]
  colFields: GraphField[]
  measures: GraphMeasure[]
  stacked?: boolean
  orderBy?: string
}
