// @odooseek/odoo-client — Framework-agnostic Odoo 19 CE JSON-RPC client
//
// Usage:
//   import { callKw, searchRead, parseListXml, type OdooFieldMeta } from '@odooseek/odoo-client'

export { callKw, searchRead, read, getViews, readGroup, nameSearch, fieldsGet, callButton, loadAction, resolveAction } from './api'
export type { OdooAction } from './api'

export { parseListXml, parseFormXml, parseKanbanXml, parseKanbanFields, parseKanbanTemplate, parseSearchXml, parsePivotXml, parseGraphXml, parseCalendarXml, parseSearchPanel } from './xml-parser'

export { evalCondition, getValue, evalModifier, getDecorationClass, parseDomainString } from './expression-evaluator'

export { fetchMenus, getApps, getMenu, getMenuAsTree, getAppSections, flattenMenuItems, searchMenus } from './menu-service'
export type { OdooMenuEntry, MenusData, MenuTreeNode } from './menu-service'

export { formatFloatTime, parseFloatTime, formatPercentage, parsePercentage, formatRemainingDays } from './field-formatters'

export { cacheKey, getCachedViews, setCachedViews } from './view-cache'

export { renderCell } from './list-formatters'
export { FIELD_TYPE_WIDTHS, DEFAULT_COL_WIDTH } from './list-formatters'

export { generateReport } from './report'

export type {
  ViewType,
  OdooFieldMeta,
  ViewField,
  ParsedListView,
  ParsedFormView,
  ParsedKanbanView,
  ParsedSearchView,
  ParsedPivotView,
  ParsedGraphView,
  ParsedCalendarView,
  FormElement,
  FieldElement,
  ButtonElement,
  HeaderElement,
  GroupElement,
  NotebookElement,
  KanbanTemplateNode,
  SearchFilter,
  SearchGroupBy,
  PivotField,
  PivotMeasure,
  GraphField,
  GraphMeasure,
  ListColumn,
  ToolbarAction,
  ViewToolbar,
  IrFilterRecord,
  SearchPanelField,
  SearchPanelCategory,
} from './types'

export { listFormatters as ListFormatters } from './list-formatters'
