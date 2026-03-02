// Router Agent — classifies user messages and dispatches to appropriate handler.
// Greeting fast-path via regex, everything else via query understanding agent.

import type { RouterResult, Signal } from '@prism/shared'
import { classifyByPatternWithoutSignals } from './patterns'
import { understandQuery } from './query-understanding'
import { formatContextForPrompt, hasRecentAnalysis } from './personal-context-store'

// ── Fast Routing (greetings only) ────────────────────────────
// Only catches unambiguous greetings via regex.
// Returns null for everything else → falls through to query understanding agent.
export function routeUserMessageFast(params: {
  readonly userId: string
  readonly message: string
}): RouterResult | null {
  const { userId, message } = params
  const patternIntent = classifyByPatternWithoutSignals(message)

  if (patternIntent && patternIntent.route === 'chat') {
    return {
      intent: patternIntent,
      personalContextPrompt: formatContextForPrompt(userId),
    }
  }

  return null
}

// ── Full Routing (query understanding agent) ─────────────────
export async function routeUserMessage(params: {
  readonly userId: string
  readonly message: string
  readonly activeSignals: readonly Signal[]
  readonly recentMessages?: readonly { role: string; content: string }[]
}): Promise<RouterResult> {
  const { userId, message, activeSignals, recentMessages } = params

  const personalContextPrompt = formatContextForPrompt(userId)

  const intent = await understandQuery({
    message,
    activeSignals,
    recentMessages,
    personalContextSummary: personalContextPrompt.slice(0, 200),
    hasRecentAnalysis: hasRecentAnalysis(userId),
  })

  return {
    intent,
    personalContextPrompt,
  }
}

// Re-exports for server convenience
export {
  getPersonalContext,
  addCorrection,
  addAnalysisMemory,
  addAssertion,
  formatContextForPrompt,
  hasRecentAnalysis,
  getLatestAnalysisMemory,
  addWatchedSignal,
  removeWatchedSignal,
  getWatchedSignals,
  updateWatchedSignalCheck,
} from './personal-context-store'
export { extractAssertions } from './assertion-extractor'
export { classifyByPatternWithoutSignals } from './patterns'
