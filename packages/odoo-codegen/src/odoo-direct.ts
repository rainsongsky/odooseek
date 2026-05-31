/**
 * Odoo connector — connects via BFF proxy.
 * Handles session authentication for CLI usage.
 */

export interface OdooConnection {
  baseUrl: string
  db: string
  cookie?: string
}

let _callId = 0

/** Authenticate with the BFF and get a session cookie */
export async function odooLogin(
  baseUrl: string,
  db: string,
  login: string,
  password: string,
): Promise<string> {
  const url = `${baseUrl}/api/session/login`
  const body = JSON.stringify({ db, login, password })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (!res.ok) {
    throw new Error(`Login failed: ${res.status}`)
  }

  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) {
    throw new Error('Login succeeded but no session cookie returned')
  }

  const match = setCookie.match(/session_id=([^;]+)/)
  if (!match) {
    throw new Error('Could not extract session_id from Set-Cookie')
  }

  return match[1]
}

export async function odooCallKw(
  conn: OdooConnection,
  model: string,
  method: string,
  args: unknown[] = [],
  kwargs: Record<string, unknown> = {},
): Promise<unknown> {
  const url = `${conn.baseUrl}/api/odoo/web/dataset/call_kw/${model}/${method}`
  const id = ++_callId

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (conn.cookie) {
    headers['Cookie'] = `session_id=${conn.cookie}`
  }

  const body = JSON.stringify({
    jsonrpc: '2.0',
    method: 'call',
    params: { model, method, args, kwargs },
    id,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  })

  if (!res.ok) {
    throw new Error(`BFF returned ${res.status}`)
  }

  const json: {
    result?: unknown
    error?: { message: string; data?: { message?: string } }
  } = await res.json()

  if (json.error) {
    throw new Error(json.error.data?.message ?? json.error.message)
  }

  return json.result
}

export async function odooFieldsGet(
  conn: OdooConnection,
  model: string,
): Promise<
  Record<
    string,
    {
      name: string
      type: string
      string: string
      required: boolean
      help?: string
      selection?: [string, string][]
      relation?: string
    }
  >
> {
  return odooCallKw(conn, model, 'fields_get', [
    [],
    ['string', 'help', 'selection', 'relation', 'type', 'required', 'relation'],
  ]) as Promise<Record<string, never>>
}
