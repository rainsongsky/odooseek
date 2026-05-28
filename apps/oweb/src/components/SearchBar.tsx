import { useCallback, useState } from 'react'
import type { ViewField } from '../lib/odoo-types'

interface SearchBarProps {
  onSearch: (domain: unknown[], keyword: string) => void
  placeholder?: string
  searchFields?: ViewField[]
}

export function SearchBar({
  onSearch,
  placeholder = 'Search...',
  searchFields,
}: SearchBarProps) {
  const [keyword, setKeyword] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Use search view fields, fallback to model defaults
  const advancedFields = searchFields?.length
    ? searchFields.map((f) => ({ name: f.name, label: f.string || f.name }))
    : [
        { name: 'name', label: 'Name' },
        { name: 'id', label: 'ID' },
        { name: 'create_date', label: 'Created' },
        { name: 'write_date', label: 'Updated' },
      ]

  const [field, setField] = useState(advancedFields[0]?.name ?? 'name')
  const [operator, setOperator] = useState('ilike')
  const [value, setValue] = useState('')

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = keyword.trim()
      if (!trimmed) { onSearch([], ''); return }
      onSearch([[field, operator, trimmed]], trimmed)
    },
    [keyword, field, operator, onSearch],
  )

  const handleReset = useCallback(() => {
    setKeyword('')
    setValue('')
    onSearch([], '')
  }, [onSearch])

  const handleAdvancedSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = value.trim()
      if (!trimmed) { onSearch([], ''); return }
      onSearch([[field, operator, trimmed]], trimmed)
    },
    [field, operator, value, onSearch],
  )

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-hover"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-hover"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </form>

      {showAdvanced && (
        <form onSubmit={handleAdvancedSubmit} className="flex gap-2">
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            {advancedFields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            {[
              ['ilike', 'contains'],
              ['=', 'equals'],
              ['!=', 'not equal'],
              ['>', 'greater than'],
              ['<', 'less than'],
            ].map(([op, label]) => (
              <option key={op} value={op}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="value"
            className="flex-1 rounded-lg border border-border-default bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110"
          >
            Filter
          </button>
        </form>
      )}
    </div>
  )
}
