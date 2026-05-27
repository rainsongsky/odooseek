interface JsonRpcResponse<T> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

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
    throw new Error(`Odoo RPC Error: ${data.error.message} (code: ${data.error.code})`)
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
  return callKw<T>(model, 'search_read', [[domain], fields], { offset, limit, order })
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

/// Get model field metadata
export function fieldsGet<T = unknown>(
  model: string,
  allfields: string[] = [],
  attributes: string[] = ['string', 'type', 'required', 'readonly', 'relation'],
): Promise<T> {
  return callKw<T>(model, 'fields_get', [allfields], { attributes })
}
