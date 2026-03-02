// json-parse.ts — robust JSON extraction and repair for LLM output.
// Handles markdown code fences, single quotes, trailing commas, unquoted keys, and JS comments.

export function extractJson(text: string): string {
  // Try standard markdown code fence first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  // Strip leading/trailing code fences if closing ``` was cut off
  const stripped = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '').trim()
  if (stripped !== text.trim() && (stripped.startsWith('{') || stripped.startsWith('['))) return stripped
  // Fall back to extracting the first JSON array or object
  const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

// Repair common LLM JSON errors: single quotes, trailing commas, unquoted keys, comments.
export function repairJson(text: string): string {
  let result = text
  // Remove JS-style comments (// and /* */)
  result = result.replace(/\/\/[^\n]*/g, '')
  result = result.replace(/\/\*[\s\S]*?\*\//g, '')
  // Remove trailing commas before } or ]
  result = result.replace(/,\s*([}\]])/g, '$1')
  // Replace single-quoted strings with double-quoted strings.
  // Walk character by character to avoid breaking apostrophes inside double-quoted strings.
  const chars: string[] = []
  let inDouble = false
  let inSingle = false
  let escaped = false
  for (let i = 0; i < result.length; i++) {
    const ch = result[i]
    if (escaped) {
      chars.push(ch)
      escaped = false
      continue
    }
    if (ch === '\\') {
      chars.push(ch)
      escaped = true
      continue
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      chars.push(ch)
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      chars.push('"')
    } else {
      if (inSingle && ch === '"') {
        chars.push('\\"')
      } else {
        chars.push(ch)
      }
    }
  }
  result = chars.join('')
  // Fix unquoted property names: word chars before a colon that aren't already quoted
  result = result.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g, '$1"$2"$3')
  return result
}

// Extract JSON from LLM text, repair if needed, then parse.
// Returns `any` to match JSON.parse behavior — callers validate with Zod or type assertions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseJsonSafe(text: string): any {
  const extracted = extractJson(text)
  try {
    return JSON.parse(extracted)
  } catch {
    const repaired = repairJson(extracted)
    return JSON.parse(repaired)
  }
}
