import { StructuredResponseDataSchema, type StructuredResponseData } from '@prism/shared'

// ── Parse Result ───────────────────────────────────────────
export type ParseResult =
  | { readonly kind: 'structured'; readonly data: StructuredResponseData }
  | { readonly kind: 'text'; readonly text: string; readonly suggestions: readonly string[] }

/**
 * Attempts to parse the raw LLM text as structured JSON.
 * Falls back to plain text with `>> ` suggestion extraction.
 */
export function parseStructuredResponse(rawText: string): ParseResult {
  const json = extractJson(rawText)

  if (json !== null) {
    const result = StructuredResponseDataSchema.safeParse(json)
    if (result.success) {
      return { kind: 'structured', data: result.data }
    }
  }

  // Fall back to plain text with suggestion parsing
  const { text, suggestions } = extractSuggestions(rawText)
  return { kind: 'text', text, suggestions }
}

// ── JSON Extraction ────────────────────────────────────────

function extractJson(raw: string): unknown {
  // Try ```json code fence extraction
  const fenceMatch = raw.match(/```json\s*\n([\s\S]*?)\n\s*```/)
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1])
    } catch {
      // Malformed JSON inside fence — fall through
    }
  }

  // Try raw JSON starting with `{`
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // Not valid JSON — fall through
    }
  }

  return null
}

// ── Suggestion Extraction (existing >> prefix logic) ───────

function extractSuggestions(fullText: string): {
  readonly text: string
  readonly suggestions: readonly string[]
} {
  const suggestionLines: string[] = []
  const responseLines = fullText.split('\n')
  let cleanEndIndex = responseLines.length

  for (let i = responseLines.length - 1; i >= 0; i--) {
    const trimmed = responseLines[i].trim()
    if (trimmed.startsWith('>> ')) {
      suggestionLines.unshift(trimmed.slice(3).trim())
      cleanEndIndex = i
    } else if (trimmed === '' && suggestionLines.length > 0) {
      cleanEndIndex = i
    } else {
      break
    }
  }

  const cleanText = responseLines.slice(0, cleanEndIndex).join('\n').trimEnd()
  return { text: cleanText, suggestions: suggestionLines.slice(0, 3) }
}
