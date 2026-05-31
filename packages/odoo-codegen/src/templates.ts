import type { TsProperty } from './type-mapper'

function escapeStringLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function renderModelFile(
  model: string,
  properties: TsProperty[],
): string {
  const nameParts = model.split('.')
  const typeName = nameParts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')

  const ifaceName = `${typeName}Record`
  const fieldNameType = `${typeName}FieldName`
  const searchResultType = `${typeName}SearchResult`

  const propLines = properties
    .filter((p) => p.name !== 'id' && p.name !== 'display_name')
    .map((p) => {
      const doc = p.doc ? `  /** ${escapeStringLiteral(p.doc)} */\n` : ''
      return `${doc}  ${p.name}: ${p.type}`
    })

  return `// Auto-generated from ${model} (Odoo fields_get)
// DO NOT EDIT — run \`bun run generate\` in @odooseek/odoo-codegen to regenerate

import type { BaseRecord, ModelFieldName, ModelRecord } from '../core'

/** ${model} */
export interface ${ifaceName} extends BaseRecord {
${propLines.join('\n')}
}

/** Field names for ${model} */
export type ${fieldNameType} = ModelFieldName<${ifaceName}>

/** Typed search_read result */
export type ${searchResultType} = ModelRecord<${ifaceName}>
`
}

export function renderBarrelExport(models: string[]): string {
  const lines = models.map((model) => {
    const nameParts = model.split('.')
    const typeName = nameParts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('')
    return `export type { ${typeName}Record, ${typeName}FieldName, ${typeName}SearchResult } from './models/${model}'`
  })

  return `// Auto-generated barrel export — DO NOT EDIT\n\n${lines.join('\n')}\n`
}
