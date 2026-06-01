/** Pagination state exposed by OdooListRenderer for ControlPanel integration. */
export interface ListPagerInfo {
  offset: number
  limit: number
  total: number
  onPageChange: (offset: number) => void
  onLimitChange: (limit: number) => void
}
