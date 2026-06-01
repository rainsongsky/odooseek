export function ListSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 animate-pulse">
      <div className="mb-3 h-8 w-48 shrink-0 rounded bg-hover/50" />
      <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border-subtle/50 py-2.5">
            <div className="h-4 w-8 rounded bg-hover/30" />
            <div className="h-4 flex-1 rounded bg-hover/30" />
            <div className="h-4 w-24 rounded bg-hover/30" />
            <div className="h-4 w-16 rounded bg-hover/30" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormSheetSkeleton() {
  return (
    <div className="o_form_sheet animate-pulse space-y-4">
      <div className="flex gap-2 border-b border-border-subtle pb-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-8 w-24 rounded bg-hover/30" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 rounded bg-hover/30" />
            <div className="h-8 w-full rounded bg-hover/20" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border-subtle bg-surface px-4 py-3">
        <div className="mx-auto flex w-full max-w-[1400px] gap-3">
          <div className="h-6 w-32 rounded bg-hover/50" />
          <div className="h-6 w-24 rounded bg-hover/30" />
        </div>
      </div>
      <div className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-2">
        <div className="o_form_sheet_bg">
          <FormSheetSkeleton />
        </div>
      </div>
    </div>
  )
}

export function KanbanSkeleton() {
  return (
    <div className="flex min-h-0 w-full flex-1 gap-4 overflow-x-auto p-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="flex min-w-64 flex-1 animate-pulse flex-col rounded-lg border border-border-subtle bg-surface/30"
        >
          <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
            <div className="h-4 w-20 rounded bg-hover/50" />
            <div className="h-4 w-8 rounded bg-hover/30" />
          </div>
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="rounded-lg border border-border-subtle bg-surface p-3">
                <div className="mb-2 h-4 w-3/4 rounded bg-hover/30" />
                <div className="h-3 w-1/2 rounded bg-hover/20" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PivotSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden animate-pulse">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-2">
        <div className="mr-auto h-5 w-32 rounded bg-hover/50" />
        <div className="h-6 w-16 rounded bg-hover/30" />
        <div className="h-6 w-16 rounded bg-hover/30" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <div className="h-full min-h-[16rem] rounded-lg border border-border-subtle bg-surface/30">
          <div className="grid h-full grid-cols-4 gap-px bg-border-subtle p-px">
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} className="bg-surface p-3">
                <div className="h-3 w-12 rounded bg-hover/30" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function GraphSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden animate-pulse">
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-2">
        <div className="mr-auto h-5 w-28 rounded bg-hover/50" />
        <div className="h-6 w-20 rounded bg-hover/30" />
        <div className="h-6 w-20 rounded bg-hover/30" />
      </div>
      <div className="flex min-h-0 flex-1 items-end gap-2 px-8 pb-8 pt-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-hover/30"
            style={{ height: `${30 + (i % 4) * 15}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function CalendarSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 animate-pulse">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div className="h-8 w-40 rounded bg-hover/50" />
        <div className="flex gap-2">
          <div className="h-8 w-16 rounded bg-hover/30" />
          <div className="h-8 w-16 rounded bg-hover/30" />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 gap-px rounded-lg border border-border-subtle bg-border-subtle">
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="min-h-[4rem] bg-surface p-2">
            <div className="mb-2 h-3 w-4 rounded bg-hover/30" />
            {i % 3 === 0 && <div className="h-4 w-full rounded bg-hover/20" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: string
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      {icon && <span className="mb-4 text-4xl opacity-30">{icon}</span>}
      <h3 className="text-base font-medium text-text-secondary">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-text-muted">{description}</p>}
    </div>
  )
}
