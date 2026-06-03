export function pythonLiteralToJson(raw: string): string {
  let out = ''
  let inString = false
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]
    if (ch === "'") {
      inString = !inString
      out += '"'
      i++
    } else if (inString) {
      out += ch
      i++
    } else {
      if (raw.startsWith('False', i) && !isIdentChar(raw[i + 5])) {
        out += 'false'
        i += 5
      } else if (raw.startsWith('True', i) && !isIdentChar(raw[i + 4])) {
        out += 'true'
        i += 4
      } else if (raw.startsWith('None', i) && !isIdentChar(raw[i + 4])) {
        out += 'null'
        i += 4
      } else if (ch === '(') {
        out += '['
        i++
      } else if (ch === ')') {
        out += ']'
        i++
      } else {
        out += ch
        i++
      }
    }
  }
  return out
}

function isIdentChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\w]/.test(ch)
}
