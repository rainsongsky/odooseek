export function ListSkeleton() {
  return (
    <div className="animate-pulse p-4">
      <div className="mb-3 h-8 w-48 rounded bg-hover/50" />
      <div className="space-y-2">
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

export function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto p-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex w-64 shrink-0 animate-pulse flex-col rounded-lg border border-border-subtle bg-surface/30">
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

export function EmptyState({ icon, title, description }: { icon?: string; title: string; description?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
      {icon && <span className="mb-4 text-4xl opacity-30">{icon}</span>}
      <h3 className="text-base font-medium text-text-secondary">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-text-muted">{description}</p>}
    </div>
  )
}
