import { SignalSchema, type Signal } from '@prism/shared'

export interface GroundingSource {
  readonly title: string
  readonly url: string
  readonly domain?: string
}

export interface GroundingContext {
  readonly sources: ReadonlyArray<GroundingSource>
  readonly searchQueries: ReadonlyArray<string>
  readonly supportSegments: ReadonlyArray<{
    readonly text: string
    readonly sourceIndices: ReadonlyArray<number>
  }>
}

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

/** Validate and return an ISO date string, or null if invalid/in the future. */
function parseIsoDate(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  // Reject dates more than 30 days in the past or in the future
  const now = Date.now()
  if (date.getTime() > now) return null
  if (now - date.getTime() > 30 * 24 * 60 * 60 * 1000) return null
  return date.toISOString()
}

/** Pick the earliest valid publishedAt from a signal's sources. */
function earliestSourceDate(
  sources: ReadonlyArray<{ readonly publishedAt?: string }>,
): string | null {
  let earliest: number | null = null
  for (const s of sources) {
    if (!s.publishedAt) continue
    const ts = new Date(s.publishedAt).getTime()
    if (!Number.isNaN(ts) && (earliest === null || ts < earliest)) {
      earliest = ts
    }
  }
  return earliest !== null ? new Date(earliest).toISOString() : null
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
      publishedAt: parseIsoDate(asString(raw.publishedAt)) ?? undefined,
    })
  }

  return sources
}

/**
 * Match a parsed source title against grounding metadata to find a real URL.
 * Uses fuzzy matching: lowercase, strip punctuation, check if one contains the other.
 */
function findGroundingUrl(
  title: string,
  groundingSources: ReadonlyArray<GroundingSource>,
): string | null {
  if (groundingSources.length === 0) return null
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  if (!normalizedTitle) return null

  for (const gs of groundingSources) {
    const normalizedGs = gs.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
    // Check if either title contains the other (fuzzy match)
    if (normalizedTitle.includes(normalizedGs) || normalizedGs.includes(normalizedTitle)) {
      return gs.url
    }
    // Check for significant word overlap (at least 3 matching words)
    const titleWords = new Set(normalizedTitle.split(/\s+/))
    const gsWords = normalizedGs.split(/\s+/)
    const overlap = gsWords.filter((w) => titleWords.has(w) && w.length > 2).length
    if (overlap >= 3) {
      return gs.url
    }
  }
  return null
}

/**
 * Replace LLM-hallucinated URLs with real grounding metadata URLs where possible.
 * For sources without a grounding match, strips the URL to prevent 404s.
 */
function applyGroundingToSources(
  sources: ReadonlyArray<{ readonly title: string; readonly url: string; readonly publisher?: string; readonly publishedAt?: string }>,
  groundingSources: ReadonlyArray<GroundingSource>,
): ReadonlyArray<{ readonly title: string; readonly url: string; readonly publisher?: string; readonly publishedAt?: string }> {
  if (groundingSources.length === 0) return sources

  // Track which grounding sources have been used
  const usedGroundingUrls = new Set<string>()

  const updated = sources.map((source) => {
    const groundingUrl = findGroundingUrl(source.title, groundingSources)
    if (groundingUrl) {
      usedGroundingUrls.add(groundingUrl)
      return { ...source, url: groundingUrl }
    }
    // No grounding match — LLM URLs are nearly always hallucinated.
    // Replace with a Google Search link so the user gets relevant results instead of a 404.
    const searchQuery = encodeURIComponent(source.title)
    return { ...source, url: `https://www.google.com/search?q=${searchQuery}` }
  })

  // Append any unused grounding sources as additional evidence
  for (const gs of groundingSources) {
    if (!usedGroundingUrls.has(gs.url)) {
      // Check if this grounding source isn't already represented
      const alreadyPresent = updated.some((s) => s.url === gs.url)
      if (!alreadyPresent) {
        updated.push({
          title: gs.title,
          url: gs.url,
          publisher: gs.domain,
        })
      }
    }
  }

  return updated
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
 * When groundingSources are provided, replaces hallucinated URLs with real grounding metadata URLs.
 */
export function parseSignalResponseWithDiagnostics(
  responseText: string,
  groundingSources: ReadonlyArray<GroundingSource> = [],
): SignalParseResult {
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

      const rawSources = parseSources(raw.sources)
      const sources = applyGroundingToSources(rawSources, groundingSources)

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
        detectedAt: earliestSourceDate(sources) ?? new Date().toISOString(),
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
