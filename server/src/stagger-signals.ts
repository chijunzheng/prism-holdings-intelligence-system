// Stagger Signal Timestamps — spreads signals across realistic time offsets
// when they were all detected in the same batch (same detectedAt).
// Critical/high urgency signals appear more recent; lower urgency signals older.

import type { Signal } from '@prism/shared'

const URGENCY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// Time offsets in minutes — signals spread across recent history
const STAGGER_OFFSETS_MIN = [8, 25, 55, 120, 195, 290, 400, 520, 660, 800]

/**
 * If all signals share the same detectedAt (batch detection), stagger them
 * so the UI shows varied relative times. Signals are sorted by urgency
 * (critical first = most recent) with ties broken by original order.
 */
export function staggerSignalTimestamps(signals: readonly Signal[]): readonly Signal[] {
  if (signals.length <= 1) return signals

  // Check if all timestamps are within 60 seconds of each other (batch detection)
  const timestamps = signals.map((s) => new Date(s.detectedAt).getTime())
  const minTs = Math.min(...timestamps)
  const maxTs = Math.max(...timestamps)
  const allSameTime = (maxTs - minTs) < 60_000

  if (!allSameTime) return signals

  // Sort by urgency (critical first), preserving order within same urgency
  const indexed = signals.map((s, i) => ({ signal: s, originalIndex: i }))
  const sorted = [...indexed].sort((a, b) => {
    const urgA = URGENCY_ORDER[a.signal.urgency] ?? 2
    const urgB = URGENCY_ORDER[b.signal.urgency] ?? 2
    if (urgA !== urgB) return urgA - urgB
    return a.originalIndex - b.originalIndex
  })

  const now = Date.now()
  return sorted.map((entry, i) => {
    const offsetMs = (STAGGER_OFFSETS_MIN[i] ?? STAGGER_OFFSETS_MIN[STAGGER_OFFSETS_MIN.length - 1] + i * 90) * 60_000
    return {
      ...entry.signal,
      detectedAt: new Date(now - offsetMs).toISOString(),
    }
  })
}
