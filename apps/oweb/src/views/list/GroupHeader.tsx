import type { ListColumn, OdooFieldMeta, ViewField } from '@odooseek/odoo-client'
import { renderCell } from '@odooseek/odoo-client'
import { ChevronRight } from '@/lib/lucide-icons'
import { isNonField } from './listUtils'

function renderListCellContent(content: unknown): React.ReactNode {
  if (content && typeof content === 'object' && 'src' in (content as Record<string, unknown>)) {
    const img = content as { src: string }
    return <img src={img.src} alt="" className="h-8 w-8 rounded object-cover" loading="lazy" />
  }
  return content as React.ReactNode
}

interface GroupHeaderProps {
  group: Record<string, unknown>
  depth: number
  isExpanded: boolean
  visibleColumns: ListColumn[]
  fields: Record<string, OdooFieldMeta>
  groupBy: readonly string[]
  model: string
  count: number
  onToggle: () => void
}

export function GroupHeader({
  group,
  depth,
  isExpanded,
  visibleColumns,
  fields,
  groupBy,
  model,
  count,
  onToggle,
}: GroupHeaderProps) {
  const indent = depth * 24

  return (
    <tr
      onClick={onToggle}
      className="border-b border-border-subtle bg-surface/30 transition-colors hover:bg-hover/30 cursor-pointer"
    >
      <td className="w-10 px-2 py-2">
        <div className="flex items-center" style={{ paddingLeft: indent }}>
          <ChevronRight
            className={`h-3.5 w-3.5 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        </div>
      </td>
      {visibleColumns.map((col, ci) => {
        if (isNonField(col)) return <td key={`gd-${ci}`} className="px-2 py-2" />
        const vf = col as ViewField
        const isGroupField = groupBy[depth] === vf.name
        const val = group[vf.name]
        const meta = fields[vf.name]
        return (
          <td
            key={`gd-${vf.name}-${ci}`}
            className="whitespace-nowrap px-4 py-2 text-sm text-text-primary"
          >
            {isGroupField ? (
              <>
                <span className="font-medium">
                  {renderListCellContent(renderCell(val, meta, model))}
                </span>
                <span className="ml-1.5 rounded bg-hover px-1 py-0.5 text-[10px] text-text-muted">
                  {String(count)}
                </span>
              </>
            ) : (
              <span className="text-text-muted">
                {val !== undefined && val !== null
                  ? renderListCellContent(renderCell(val, meta, model))
                  : ''}
              </span>
            )}
          </td>
        )
      })}
      {false && <td className="w-20 px-2 py-2" />}
    </tr>
  )
}
