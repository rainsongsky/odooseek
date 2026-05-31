import type { OdooFieldMeta } from '@odooseek/odoo-client'

export interface TsProperty {
  name: string
  type: string
  optional: boolean
  doc: string
}

const TYPE_MAP: Record<string, (meta: OdooFieldMeta) => string> = {
  char: () => 'string',
  text: () => 'string',
  html: () => 'string',
  integer: () => 'number',
  float: () => 'number',
  monetary: () => 'number',
  boolean: () => 'boolean',
  date: () => 'string',
  datetime: () => 'string',
  binary: () => 'string',
  many2one: (meta) => `[number, string]${meta.relation ? ` /* ${meta.relation} */` : ''}`,
  many2many: (meta) => `number[]${meta.relation ? ` /* ${meta.relation} */` : ''}`,
  one2many: (meta) => `number[]${meta.relation ? ` /* ${meta.relation} */` : ''}`,
  selection: (meta) => {
    const options = meta.selection ?? []
    if (options.length === 0) return 'string'
    return options.map(([k]) => `'${k}'`).join(' | ')
  },
}

export function mapFieldType(meta: OdooFieldMeta): { tsType: string; isNullable: boolean } {
  const mapper = TYPE_MAP[meta.type]
  const baseType = mapper ? mapper(meta) : 'unknown'

  const isNullable =
    !meta.required && meta.type !== 'boolean' && meta.type !== 'one2many'

  return { tsType: baseType, isNullable }
}

export function buildProperty(
  name: string,
  meta: OdooFieldMeta,
): TsProperty {
  const { tsType, isNullable } = mapFieldType(meta)
  const finalType = isNullable ? `${tsType} | false` : tsType

  const parts: string[] = []
  if (meta.string) parts.push(meta.string)
  if (meta.help) parts.push(meta.help)
  const doc = parts.join(' — ')

  return {
    name: toSafeTsName(name),
    type: finalType,
    optional: false,
    doc,
  }
}

/** Escape Odoo field names that are reserved in TypeScript */
function toSafeTsName(name: string): string {
  const RESERVED = new Set([
    'delete', 'class', 'export', 'import', 'default',
    'function', 'return', 'type', 'interface', 'extends',
  ])
  return RESERVED.has(name) ? `_${name}` : name
}
