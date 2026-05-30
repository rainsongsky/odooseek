interface JsonRpcResponse<T> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: {
    code: number
    message: string
    data?: {
      name?: string
      message?: string
      debug?: string
      fault_code?: number
    }
  }
}

import { parseDomainString } from './expression-evaluator'

let _callId = 0

async function jsonRpc<T>(url: string, params: Record<string, unknown>): Promise<T> {
  const id = ++_callId
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params, id }),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }

  const data: JsonRpcResponse<T> = await res.json()

  if (data.error) {
    const err = data.error
    const detail = err.data?.message || err.data?.debug?.split('\n')[0] || err.message
    throw new Error(`Odoo Error: ${detail} (code: ${err.code})`)
  }

  return data.result as T
}

const DATASET_URL = '/api/odoo/web/dataset/call_kw'

/// Call any Odoo model method via /web/dataset/call_kw
export function callKw<T = unknown>(
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  return jsonRpc<T>(DATASET_URL, { model, method, args, kwargs })
}

/// search_read: most common data fetch operation
export function searchRead<T = unknown[]>(
  model: string,
  domain: unknown[] = [],
  fields: string[] = [],
  offset = 0,
  limit = 80,
  order = '',
): Promise<T> {
  return callKw<T>(model, 'search_read', [domain, fields], { offset, limit, order })
}

/// Read specific records by ID
export function read<T = unknown[]>(
  model: string,
  ids: number[],
  fields: string[] = [],
): Promise<T> {
  return callKw<T>(model, 'read', [ids, fields])
}

/// Get views and fields in one call: get_views([[id, type], ...])
export function getViews<T = unknown>(
  model: string,
  views: [number | false, string][],
  options: Record<string, unknown> = {},
): Promise<T> {
  return callKw<T>(model, 'get_views', [views], { options })
}

/// read_group: server-side grouping with aggregation
export function readGroup<T = unknown[]>(
  model: string,
  domain: unknown[] = [],
  fields: string[] = [],
  groupBy: string[] = [],
  offset = 0,
  limit = 80,
  orderBy = '',
): Promise<T> {
  return callKw<T>(model, 'read_group', [domain, fields, groupBy], {
    offset,
    limit,
    orderby: orderBy || undefined,
    lazy: true,
  })
}

/// name_search: autocomplete search returning [[id, display_name], ...]
export function nameSearch(
  model: string,
  name: string,
  limit = 8,
): Promise<Array<[number, string]>> {
  return callKw(model, 'name_search', [], { name, operator: 'ilike', limit })
}

/// Get model field metadata
export function fieldsGet<T = unknown>(
  model: string,
  allfields: string[] = [],
  attributes: string[] = ['string', 'type', 'required', 'readonly', 'relation'],
): Promise<T> {
  return callKw<T>(model, 'fields_get', [allfields], { attributes })
}

/// Resolve an action ID to its target model name and view settings.
/// Handles both ir.actions.act_window and ir.actions.server types.
export async function resolveAction(actionId: number): Promise<{
  model: string
  viewMode: string
  domain: unknown[]
  context: Record<string, unknown>
}> {
  // Step 1: determine action type via base model
  const [base] = await callKw<Array<{ type: string }>>('ir.actions.actions', 'read', [
    [actionId],
    ['type'],
  ])
  const actionType = base?.type

  // Step 2: server actions need execution to get the actual act_window
  if (actionType === 'ir.actions.server') {
    const action = await jsonRpc<{
      res_model?: string
      view_mode?: string
      domain?: unknown[] | string
      context?: Record<string, unknown> | string
    }>('/api/odoo/web/action/run', { action_id: actionId })

    if (!action?.res_model) {
      throw new Error(`Server action ${actionId} returned no res_model`)
    }
    return {
      model: action.res_model,
      viewMode: action.view_mode || 'list',
      domain: Array.isArray(action.domain)
        ? action.domain
        : (parseDomainString(action.domain as string) ?? []),
      context: typeof action.context === 'object' && action.context !== null ? action.context : {},
    }
  }

  // Step 3: act_window — read directly
  const [action] = await callKw<
    Array<{
      res_model: string
      view_mode: string
      domain: unknown[] | string
      context: Record<string, unknown> | string
    }>
  >('ir.actions.act_window', 'read', [[actionId], ['res_model', 'view_mode', 'domain', 'context']])

  if (!action?.res_model) {
    throw new Error(`Action ${actionId} has no res_model`)
  }

  return {
    model: action.res_model,
    viewMode: action.view_mode || 'list',
    domain: Array.isArray(action.domain)
      ? action.domain
      : (parseDomainString(action.domain as string) ?? []),
    context: typeof action.context === 'object' && action.context !== null ? action.context : {},
  }
}
