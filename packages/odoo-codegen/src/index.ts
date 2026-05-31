import { resolve } from 'node:path'
import { generateAll } from './codegen'
import { odooLogin, type OdooConnection } from './odoo-direct'

const ODOO_TYPES_DIR = resolve(
  import.meta.dirname ?? '.',
  '../../odoo-types/src/generated',
)

function parseArgs() {
  const args = process.argv.slice(2)
  let check = false
  let models: string[] | undefined
  let outputDir = ODOO_TYPES_DIR
  let odooUrl: string | undefined
  let db: string | undefined
  let login: string | undefined
  let password: string | undefined

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--check':
        check = true
        break
      case '--models':
        models = args[++i]?.split(',').map((s) => s.trim())
        break
      case '--output':
        outputDir = args[++i] ?? outputDir
        break
      case '--odoo-url':
        odooUrl = args[++i]
        break
      case '--db':
        db = args[++i]
        break
      case '--login':
        login = args[++i]
        break
      case '--password':
        password = args[++i]
        break
    }
  }

  return { check, models, outputDir, odooUrl, db, login, password }
}

async function main() {
  const opts = parseArgs()

  const odooUrl = opts.odooUrl ?? process.env.ODOO_URL ?? 'http://localhost:3000'
  const db = opts.db ?? process.env.ODOO_DB ?? 'odoo'
  const login = opts.login ?? process.env.ODOO_LOGIN ?? 'admin'
  const password = opts.password ?? process.env.ODOO_PASSWORD ?? 'admin'

  console.log(`🔌 Connecting to ${odooUrl} (db: ${db})...`)

  const cookie = await odooLogin(odooUrl, db, login, password)
  console.log(`✅ Authenticated as ${login}`)

  const conn: OdooConnection = { baseUrl: odooUrl, db, cookie }

  console.log(
    opts.check
      ? '🔍 Checking generated types against Odoo...'
      : `🔧 Generating types → ${opts.outputDir}`,
  )

  const result = await generateAll({
    models: opts.models,
    outputDir: opts.outputDir,
    check: opts.check,
    conn,
  })

  if (opts.check) {
    if (result.diffs.length > 0) {
      console.error(
        `❌ ${result.diffs.length} model(s) outdated: ${result.diffs.join(', ')}`,
      )
      console.error('Run `bun run generate` to update.')
      process.exit(1)
    }
    console.log(`✅ All ${result.generated} model(s) up-to-date`)
  } else {
    console.log(`✅ Generated ${result.generated} model(s):`)
    for (const m of result.models) {
      const flag = result.errors.some((e) => e.startsWith(m)) ? ' ⚠️' : ''
      console.log(`   ${m}${flag}`)
    }
    console.log(`   + barrel export (index.ts)`)
    console.log(`📁 Output: ${opts.outputDir}`)
  }

  if (result.errors.length > 0) {
    console.warn(`⚠️  ${result.errors.length} error(s):`)
    for (const e of result.errors) {
      console.warn(`   ${e}`)
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
