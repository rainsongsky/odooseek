import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'

interface BreadcrumbsProps {
  model: string
  viewType: string
  viewTitle?: string
  recordName?: string
  onBackToList?: () => void
}

const MODULE_APP_MAP: Record<string, string> = {
  crm: 'CRM',
  sale: 'Sales',
  stock: 'Inventory',
  account: 'Accounting',
  purchase: 'Purchase',
  project: 'Project',
  hr: 'HR',
  res: 'Contacts',
}

function getAppName(model: string): string {
  const prefix = model.split('.')[0] ?? ''
  return MODULE_APP_MAP[prefix] ?? prefix.charAt(0).toUpperCase() + prefix.slice(1)
}

export function Breadcrumbs({
  model,
  viewType,
  viewTitle,
  recordName,
  onBackToList,
}: BreadcrumbsProps) {
  const navigate = useNavigate()
  const appName = useMemo(() => getAppName(model), [model])
  const isDetail = viewType === 'form'

  return (
    <nav className="flex items-center gap-1.5 py-2">
      <button
        type="button"
        onClick={() => navigate({ to: '/menu' })}
        className="text-xs font-medium text-text-muted transition-colors hover:text-accent"
      >
        {appName}
      </button>

      <span className="text-xs text-text-muted">/</span>

      {isDetail && onBackToList ? (
        <button
          type="button"
          onClick={onBackToList}
          className="text-xs font-medium text-text-muted transition-colors hover:text-accent"
        >
          {viewTitle || model}
        </button>
      ) : (
        <span className="text-xs font-medium text-text-primary">{viewTitle || model}</span>
      )}

      {isDetail && recordName && (
        <>
          <span className="text-xs text-text-muted">/</span>
          <span className="text-xs font-medium text-text-primary truncate max-w-[200px]">
            {recordName}
          </span>
        </>
      )}
    </nav>
  )
}
