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

/**
 * Generates a deterministic-ish ID from headline content.
 */
function generateSignalId(headline: string): string {
  // Simple hash-like ID from headline for dedup
  const hash = headline
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 16)
  return `sig-${hash}-${Date.now().toString(36)}`
}

/**
 * Parses raw Gemini response text into typed Signal objects.
 * Handles malformed responses gracefully.
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
      const signal = SignalSchema.parse({
        id: generateSignalId(raw.headline),
        headline: raw.headline,
        description: raw.description,
        affectedExposures: raw.affectedExposures,
        relevanceScore: Math.min(1, Math.max(0, raw.relevanceScore)),
        urgency: raw.urgency,
        temporalClassification: raw.temporalClassification,
        sources: raw.sources.map((s) => ({
          title: s.title,
          url: s.url,
          publisher: s.publisher,
          publishedAt: s.publishedAt,
        })),
        detectedAt: new Date().toISOString(),
        acknowledged: false,
      })
      signals.push(signal)
    } catch {
      // Skip malformed individual signals, continue with rest
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
    // Normalize headline for comparison
    const key = signal.headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
    const existing = seen.get(key)

    if (!existing || signal.relevanceScore > existing.relevanceScore) {
      seen.set(key, signal)
    }
  }

  return Array.from(seen.values())
}
