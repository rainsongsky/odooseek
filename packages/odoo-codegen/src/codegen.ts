import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { buildProperty, type TsProperty } from './type-mapper'
import { loadManifest } from './manifest'
import { renderModelFile, renderBarrelExport } from './templates'
import { odooFieldsGet, type OdooConnection } from './odoo-direct'

export interface GenerateOptions {
  config?: string
  models?: string[]
  outputDir: string
  check?: boolean
  conn: OdooConnection
}

export interface GenerateResult {
  models: string[]
  generated: number
  errors: string[]
  diffs: string[]
}

export async function generateAll(options: GenerateOptions): Promise<GenerateResult> {
  const manifest = await loadManifest(options.config, options.models)
  const errors: string[] = []
  const diffs: string[] = []
  let generated = 0

  const modelsDir = resolve(options.outputDir, 'models')
  await mkdir(modelsDir, { recursive: true })

  for (const model of manifest) {
    try {
      const fields = await odooFieldsGet(options.conn, model)

      const properties: TsProperty[] = Object.entries(fields).map(([name, meta]) =>
        buildProperty(name, meta),
      )

      const code = renderModelFile(model, properties)
      const filename = resolve(modelsDir, `${model}.ts`)

      if (options.check) {
        const existing = await readExisting(filename)
        if (existing !== code) {
          diffs.push(model)
        }
      } else {
        await writeFile(filename, code, 'utf-8')
      }
      generated++
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (!options.check) {
    const barrel = renderBarrelExport(manifest)
    await writeFile(resolve(options.outputDir, 'index.ts'), barrel, 'utf-8')
  }

  return { models: manifest, generated, errors, diffs }
}

async function readExisting(filepath: string): Promise<string | null> {
  try {
    return await readFile(filepath, 'utf-8')
  } catch {
    return null
  }
}
