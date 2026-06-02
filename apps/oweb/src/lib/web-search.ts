export interface WebSearch {
  model?: string
  action?: number
  viewType?: string
}

export function parseWebSearch(search: Record<string, unknown>): WebSearch {
  const rawAction = search.action
  const action =
    rawAction != null && String(rawAction).trim() !== '' ? Number(rawAction) : undefined
  return {
    model: typeof search.model === 'string' ? search.model : undefined,
    action: action != null && Number.isFinite(action) ? action : undefined,
    viewType: typeof search.viewType === 'string' ? search.viewType : undefined,
  }
}
