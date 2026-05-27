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

async function jsonRpc<T>(
  url: string,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const id = ++_callId
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
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

const RPC_URL = '/api/odoo/jsonrpc'

export function call(path: string, kwargs?: Record<string, unknown>) {
  return jsonRpc<unknown>(RPC_URL, 'call', {
    path,
    kwargs: kwargs ?? {},
  })
}

export function authenticate(db: string, login: string, password: string) {
  return jsonRpc<{ uid: number }>(RPC_URL, 'call', {
    path: '/web/session/authenticate',
    kwargs: { db, login, password },
  })
}

export function searchRead(
  model: string,
  domain: unknown[] = [],
  fields: string[] = [],
  offset = 0,
  limit = 80,
) {
  return jsonRpc<unknown[]>(RPC_URL, 'call', {
    path: '/web/dataset/search_read',
    kwargs: { model, domain, fields, offset, limit },
  })
}

export function getSession() {
  return jsonRpc<{
    uid: number
    session_id: string
    username: string
    db: string
    user_context: Record<string, unknown>
  }>(RPC_URL, 'call', {
    path: '/web/session/get_session',
    kwargs: {},
  })
}

export function destroySession() {
  return jsonRpc<null>(RPC_URL, 'call', {
    path: '/web/session/destroy',
    kwargs: {},
  })
}
