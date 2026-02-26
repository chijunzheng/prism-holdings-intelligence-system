import { SignalSchema, type Signal } from '@prism/shared'

interface RawSignalResponse {
  readonly headline?: unknown
  readonly description?: unknown
  readonly portfolioSummary?: unknown
  readonly affectedExposures?: unknown
  readonly relevanceScore?: unknown
  readonly urgency?: unknown
  readonly sentiment?: unknown
  readonly temporalClassification?: unknown
  readonly sources?: unknown
}

interface BalancedSnippet {
  readonly start: number
  readonly snippet: string
}

interface JsonObjectWithArrays {
  readonly signals?: unknown
  readonly data?: unknown
  readonly items?: unknown
  readonly events?: unknown
}

const VALID_URGENCIES = new Set(['low', 'medium', 'high', 'critical'])
const VALID_SENTIMENTS = new Set(['positive', 'negative', 'mixed'])
const VALID_TEMPORAL = new Set(['transient', 'structural', 'ambiguous'])

type PayloadContainerType = 'none' | 'array' | 'object'

export interface SignalParseDiagnostics {
  readonly responseChars: number
  readonly payloadDetected: boolean
  readonly payloadContainer: PayloadContainerType
  readonly rawSignalCount: number
  readonly acceptedCount: number
  readonly droppedMissingFields: number
  readonly droppedValidation: number
}

export interface SignalParseResult {
  readonly signals: ReadonlyArray<Signal>
  readonly diagnostics: SignalParseDiagnostics
}

/**
 * Generates a deterministic-ish ID from headline content.
 */
function generateSignalId(headline: string): string {
  const hash = headline
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16)
  return `sig-${hash}-${Date.now().toString(36)}`
}

/**
 * Normalizes a string enum value from Gemini (handles capitalization, quotes, etc.)
 */
function normalizeEnum(value: unknown, validValues: ReadonlySet<string>, fallback: string): string {
  const normalized = String(value ?? '').toLowerCase().trim().replace(/['"]/g, '')
  return validValues.has(normalized) ? normalized : fallback
}

/**
 * Sanitizes a source URL — Gemini sometimes returns malformed or placeholder URLs.
 */
function sanitizeSourceUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

function parseJson(input: string): unknown | null {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

function getPayloadContainerType(payload: unknown): PayloadContainerType {
  if (payload === null) return 'none'
  if (Array.isArray(payload)) return 'array'
  if (typeof payload === 'object') return 'object'
  return 'none'
}

function extractFirstBalanced(
  text: string,
  openChar: '[' | '{',
  closeChar: ']' | '}',
): BalancedSnippet | null {
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === openChar) {
      if (depth === 0) start = i
      depth += 1
      continue
    }

    if (char === closeChar && depth > 0) {
      depth -= 1
      if (depth === 0 && start >= 0) {
        return { start, snippet: text.slice(start, i + 1) }
      }
    }
  }

  return null
}

function extractJsonPayload(responseText: string): unknown | null {
  const trimmed = responseText.trim()
  if (!trimmed) return null

  // 1) Full text is already JSON.
  const direct = parseJson(trimmed)
  if (direct !== null) return direct

  // 2) Parse fenced blocks (```json ... ```).
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/gi
  for (const match of trimmed.matchAll(fenceRegex)) {
    const candidate = match[1]?.trim()
    if (!candidate) continue
    const parsed = parseJson(candidate)
    if (parsed !== null) return parsed
  }

  // 3) Parse first balanced JSON array/object embedded in free text.
  const arraySnippet = extractFirstBalanced(trimmed, '[', ']')
  const objectSnippet = extractFirstBalanced(trimmed, '{', '}')
  const snippets = [arraySnippet, objectSnippet]
    .filter((value): value is BalancedSnippet => Boolean(value))
    .sort((a, b) => a.start - b.start)

  for (const candidate of snippets) {
    const parsed = parseJson(candidate.snippet)
    if (parsed !== null) return parsed
  }

  return null
}

function toRawSignals(payload: unknown): ReadonlyArray<RawSignalResponse> {
  if (Array.isArray(payload)) return payload as RawSignalResponse[]
  if (!payload || typeof payload !== 'object') return []

  const container = payload as JsonObjectWithArrays
  const arrays = [container.signals, container.data, container.items, container.events]
  for (const candidate of arrays) {
    if (Array.isArray(candidate)) return candidate as RawSignalResponse[]
  }
  return []
}

function asString(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function asStringArray(value: unknown): ReadonlyArray<string> {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0)
}

function asNumber(value: unknown, fallback = 0.5): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function parseSources(value: unknown): ReadonlyArray<{
  readonly title: string
  readonly url: string
  readonly publisher?: string
  readonly publishedAt?: string
}> {
  if (!Array.isArray(value)) return []

  const sources: Array<{
    readonly title: string
    readonly url: string
    readonly publisher?: string
    readonly publishedAt?: string
  }> = []

  for (const source of value) {
    if (!source || typeof source !== 'object') continue

    const raw = source as {
      readonly title?: unknown
      readonly url?: unknown
      readonly publisher?: unknown
      readonly publishedAt?: unknown
    }
    const title = asString(raw.title)
    const url = asString(raw.url)
    if (!title || !url) continue

    sources.push({
      title,
      url: sanitizeSourceUrl(url),
      publisher: asString(raw.publisher) || undefined,
      publishedAt: undefined, // Drop publishedAt — Gemini often returns invalid ISO values.
    })
  }

  return sources
}

/**
 * Parses raw Gemini response text into typed Signal objects.
 * Normalizes common LLM quirks (capitalization, missing fields) before Zod validation.
 */
export function parseSignalResponse(responseText: string): ReadonlyArray<Signal> {
  return parseSignalResponseWithDiagnostics(responseText).signals
}

/**
 * Parses raw Gemini response text into typed Signal objects and emits parse diagnostics.
 */
export function parseSignalResponseWithDiagnostics(responseText: string): SignalParseResult {
  const diagnosticsBase: Omit<
    SignalParseDiagnostics,
    'payloadDetected' | 'payloadContainer' | 'rawSignalCount' | 'acceptedCount'
  > = {
    responseChars: responseText.length,
    droppedMissingFields: 0,
    droppedValidation: 0,
  }

  const payload = extractJsonPayload(responseText)
  if (payload === null) {
    return {
      signals: [],
      diagnostics: {
        ...diagnosticsBase,
        payloadDetected: false,
        payloadContainer: 'none',
        rawSignalCount: 0,
        acceptedCount: 0,
      },
    }
  }

  const rawSignals = toRawSignals(payload)
  if (rawSignals.length === 0) {
    return {
      signals: [],
      diagnostics: {
        ...diagnosticsBase,
        payloadDetected: true,
        payloadContainer: getPayloadContainerType(payload),
        rawSignalCount: 0,
        acceptedCount: 0,
      },
    }
  }

  const signals: Signal[] = []
  let droppedMissingFields = 0
  let droppedValidation = 0

  for (const raw of rawSignals) {
    try {
      const headline = asString(raw.headline)
      const description = asString(raw.description)
      if (!headline || !description) {
        droppedMissingFields += 1
        continue
      }

      const sources = parseSources(raw.sources)

      const signal = SignalSchema.parse({
        id: generateSignalId(headline),
        headline,
        description,
        portfolioSummary: asString(raw.portfolioSummary) || undefined,
        affectedExposures: asStringArray(raw.affectedExposures),
        relevanceScore: Math.min(1, Math.max(0, asNumber(raw.relevanceScore, 0.5))),
        urgency: normalizeEnum(raw.urgency ?? 'medium', VALID_URGENCIES, 'medium'),
        sentiment: normalizeEnum(raw.sentiment ?? 'negative', VALID_SENTIMENTS, 'negative'),
        temporalClassification: normalizeEnum(
          raw.temporalClassification ?? 'ambiguous',
          VALID_TEMPORAL,
          'ambiguous',
        ),
        sources,
        detectedAt: new Date().toISOString(),
        acknowledged: false,
      })
      signals.push(signal)
    } catch {
      // Skip signals that still fail validation after normalization
      droppedValidation += 1
      continue
    }
  }

  return {
    signals,
    diagnostics: {
      responseChars: responseText.length,
      payloadDetected: true,
      payloadContainer: getPayloadContainerType(payload),
      rawSignalCount: rawSignals.length,
      acceptedCount: signals.length,
      droppedMissingFields,
      droppedValidation,
    },
  }
}

/**
 * Deduplicates signals with similar headlines.
 * Keeps the one with higher relevance score.
 */
export function deduplicateSignals(
  signals: ReadonlyArray<Signal>,
): ReadonlyArray<Signal> {
  const seen = new Map<string, Signal>()

  for (const signal of signals) {
    const key = signal.headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    const existing = seen.get(key)

    if (!existing || signal.relevanceScore > existing.relevanceScore) {
      seen.set(key, signal)
    }
  }

  return Array.from(seen.values())
}
