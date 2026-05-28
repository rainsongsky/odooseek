interface PaginationProps {
  page: number
  total: number
  limit: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

const PAGE_SIZES = [40, 80, 200, 500] as const

export function Pagination({ page, total, limit, onPageChange, onLimitChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="flex items-center justify-between px-1">
      <select
        value={limit}
        onChange={(e) => onLimitChange(Number(e.target.value))}
        className="rounded border border-border-default bg-surface px-2 py-1 text-xs text-text-secondary"
      >
        {PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(0)}
          disabled={page === 0}
          className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          «
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
          className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹
        </button>
        <span className="text-xs text-text-muted">
          Page {page + 1} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          ›
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages - 1)}
          disabled={page >= totalPages - 1}
          className="rounded border border-border-default px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          »
        </button>
      </div>
    </div>
  )
}
