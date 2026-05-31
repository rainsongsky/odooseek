import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

interface ModelsConfig {
  version: string
  models: string[]
}

const DEFAULT_CONFIG_PATH = resolve(import.meta.dirname ?? '.', '../config/models.json')

export async function loadManifest(
  configPath?: string,
  explicitModels?: string[],
): Promise<string[]> {
  if (explicitModels && explicitModels.length > 0) {
    return [...new Set(explicitModels)]
  }

  const path = configPath ?? DEFAULT_CONFIG_PATH
  const raw = await readFile(path, 'utf-8')
  const config = JSON.parse(raw) as ModelsConfig

  if (!config.models || !Array.isArray(config.models)) {
    throw new Error(`Invalid models config at ${path}: expected { models: string[] }`)
  }

  return [...new Set(config.models)].sort()
}
