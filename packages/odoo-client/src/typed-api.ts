import { callKw, searchRead } from './api'

/** Context for RPC calls */
export interface RpcContext {
  active_id?: number
  active_ids?: number[]
  active_model?: string
  lang?: string
  tz?: string
  uid?: number
  [key: string]: unknown
}

/**
 * Type-safe wrapper around callKw for model reads.
 * @example
 * const partners = await readModel<ResPartnerRecord>('res.partner', [1, 2], ['id', 'name'])
 * partners[0].name // string — no cast needed
 */
export async function readModel<T extends Record<string, unknown>>(
  model: string,
  ids: number[],
  fields: string[],
): Promise<T[]> {
  return callKw<T[]>(model, 'read', [ids, fields])
}

/**
 * Type-safe wrapper around searchRead.
 * @example
 * const leads = await searchReadModel<CrmLeadSearchResult>(
 *   'crm.lead', [['type', '=', 'opportunity']], ['id', 'name']
 * )
 * leads[0].name // string
 */
export async function searchReadModel<T extends Record<string, unknown>>(
  model: string,
  domain: unknown[],
  fields: string[],
  offset?: number,
  limit?: number,
  order?: string,
): Promise<T[]> {
  return searchRead<T[]>(model, domain, fields, offset, limit, order)
}

/**
 * Type-safe wrapper for reading a single record by ID.
 */
export async function readSingleModel<T extends Record<string, unknown>>(
  model: string,
  id: number,
  fields: string[],
): Promise<T | undefined> {
  const results = await readModel<T>(model, [id], fields)
  return results[0]
}

/**
 * Type-safe write wrapper.
 */
export async function writeModel(
  model: string,
  ids: number[],
  values: Record<string, unknown>,
): Promise<boolean> {
  return callKw<boolean>(model, 'write', [ids, values])
}

/**
 * Type-safe create wrapper.
 */
export async function createModel<T = number>(
  model: string,
  values: Record<string, unknown>,
): Promise<T> {
  return callKw<T>(model, 'create', [values])
}

/**
 * Type-safe unlink wrapper.
 */
export async function unlinkModel(
  model: string,
  ids: number[],
): Promise<boolean> {
  return callKw<boolean>(model, 'unlink', [ids])
}

/**
 * Type-safe default_get wrapper.
 */
export async function defaultGetModel<T extends Record<string, unknown>>(
  model: string,
  fields: string[],
): Promise<T> {
  return callKw<T>(model, 'default_get', [fields])
}
