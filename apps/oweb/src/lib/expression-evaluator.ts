/** Safe client-side QWeb expression evaluator for kanban templates */

function resolveValue(expr: string, record: Record<string, unknown>): unknown {
  const m = expr.match(/^record\.(\w+)(?:\[(\d+)\])?$/)
  if (m) {
    const val = record[m[1]]
    if (m[2] !== undefined && Array.isArray(val)) return val[Number(m[2])]
    return val
  }
  return undefined
}

/** Evaluate a QWeb condition expression against a record */
export function evalCondition(expr: string, record: Record<string, unknown>): boolean {
  // Handle: "record.field"
  if (expr.startsWith('record.')) {
    const val = resolveValue(expr, record)
    return !!val
  }

  // Handle: "!record.field"
  const notMatch = expr.match(/^!\s*record\.(\w+)$/)
  if (notMatch) {
    return !record[notMatch[1]]
  }

  // Handle: "expr1 && expr2"
  const andParts = splitExpr(expr, '&&')
  if (andParts.length > 1) return andParts.every((p) => evalCondition(p.trim(), record))

  // Handle: "expr1 || expr2"
  const orParts = splitExpr(expr, '||')
  if (orParts.length > 1) return orParts.some((p) => evalCondition(p.trim(), record))

  return !!resolveValue(expr, record)
}

function splitExpr(expr: string, sep: string): string[] {
  const result: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < expr.length - sep.length + 1; i++) {
    if (expr[i] === '(') depth++
    if (expr[i] === ')') depth--
    if (depth === 0 && expr.slice(i, i + sep.length) === sep) {
      result.push(expr.slice(start, i).trim())
      start = i + sep.length
      i += sep.length - 1
    }
  }
  result.push(expr.slice(start).trim())
  return result
}

/** Get a value from an expression against a record */
export function getValue(expr: string, record: Record<string, unknown>): unknown {
  return resolveValue(expr, record)
}
