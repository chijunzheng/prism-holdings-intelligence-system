// Pattern-based pre-classification for the router agent.
// Minimal: only unambiguous greeting fast-paths.
// Ticker extraction and all nuanced classification are handled by
// the query understanding agent to avoid false positives (MY→Macy's, ALL→Allstate).

import type { RouterIntent } from '@prism/shared'

// ── Pattern Definitions ──────────────────────────────────────

const CHAT_ONLY_PATTERNS = [
  /^(?:hi|hello|hey|thanks|thank you|good morning|good afternoon|good evening)/i,
  /^(?:can you|could you|please)\s+(?:help|explain|clarify)/i,
]

// ── Signal-Independent Classification ────────────────────────
// Only handles unambiguous greeting fast-paths.
// Everything else (including ticker extraction) falls through to
// the query understanding agent.

export function classifyByPatternWithoutSignals(
  message: string,
): RouterIntent | null {
  const trimmed = message.trim()
  if (!trimmed) return null

  for (const pattern of CHAT_ONLY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        route: 'chat',
        confidence: 0.85,
        reasoning: 'General conversational or greeting message',
      }
    }
  }

  // No match → needs query understanding agent
  return null
}
