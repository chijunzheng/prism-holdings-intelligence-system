import { SignalSchema, type Signal } from '@prism/shared'

interface RawSignalResponse {
  readonly headline: string
  readonly description: string
  readonly affectedExposures: ReadonlyArray<string>
  readonly relevanceScore: number
  readonly urgency: string
  readonly temporalClassification: string
  readonly sources: ReadonlyArray<{
    readonly title: string
    readonly url: string
    readonly publisher?: string
    readonly publishedAt?: string
  }>
}

const VALID_URGENCIES = new Set(['low', 'medium', 'high', 'critical'])
const VALID_TEMPORAL = new Set(['transient', 'structural', 'ambiguous'])

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
function normalizeEnum(value: string, validValues: ReadonlySet<string>, fallback: string): string {
  const normalized = value.toLowerCase().trim().replace(/['"]/g, '')
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

/**
 * Parses raw Gemini response text into typed Signal objects.
 * Normalizes common LLM quirks (capitalization, missing fields) before Zod validation.
 */
export function parseSignalResponse(responseText: string): ReadonlyArray<Signal> {
  // Extract JSON array from response (Gemini may include markdown fences)
  const jsonMatch = responseText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  let rawSignals: RawSignalResponse[]
  try {
    rawSignals = JSON.parse(jsonMatch[0])
  } catch {
    return []
  }

  if (!Array.isArray(rawSignals)) return []

  const signals: Signal[] = []

  for (const raw of rawSignals) {
    try {
      if (!raw.headline || !raw.description) continue

      const sources = (raw.sources ?? [])
        .filter((s) => s.title && s.url)
        .map((s) => ({
          title: s.title,
          url: sanitizeSourceUrl(s.url),
          publisher: s.publisher ?? undefined,
          publishedAt: undefined, // Drop publishedAt — Gemini rarely returns valid ISO datetime
        }))

      const signal = SignalSchema.parse({
        id: generateSignalId(raw.headline),
        headline: raw.headline,
        description: raw.description,
        affectedExposures: raw.affectedExposures ?? [],
        relevanceScore: Math.min(1, Math.max(0, Number(raw.relevanceScore) || 0.5)),
        urgency: normalizeEnum(raw.urgency ?? 'medium', VALID_URGENCIES, 'medium'),
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
      continue
    }
  }

  return signals
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
