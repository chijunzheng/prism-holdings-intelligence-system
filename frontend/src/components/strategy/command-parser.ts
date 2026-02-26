export type StrategyCommand =
  | { readonly type: 'build_draft'; readonly seedSummary: string }
  | { readonly type: 'add_candidate'; readonly ticker: string }
  | { readonly type: 'remove_candidate'; readonly ticker: string }
  | { readonly type: 'set_allocation'; readonly ticker: string; readonly allocationPct: number }
  | { readonly type: 'evaluate_scenario' }
  | { readonly type: 'help' }
  | { readonly type: 'unknown' }

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function parseStrategyCommand(message: string): StrategyCommand {
  const text = message.trim()
  if (!text) return { type: 'unknown' }

  const lower = text.toLowerCase()
  if (/\b(help|commands|examples)\b/.test(lower)) {
    return { type: 'help' }
  }

  const allocationMatch = lower.match(
    /\b(?:set|size|allocate|adjust)\s+([a-z][a-z0-9.\-]{0,9})\s+(?:to\s+)?([0-9]+(?:\.[0-9]+)?)\s*%?\b/i,
  )
  if (allocationMatch) {
    return {
      type: 'set_allocation',
      ticker: normalizeTicker(allocationMatch[1]),
      allocationPct: clamp(Number(allocationMatch[2]), 0.5, 10),
    }
  }

  const addMatch = lower.match(/\b(?:add|include|insert)\s+([a-z][a-z0-9.\-]{0,9})\b/i)
  if (addMatch) {
    return { type: 'add_candidate', ticker: normalizeTicker(addMatch[1]) }
  }

  const removeMatch = lower.match(/\b(?:remove|delete|drop)\s+([a-z][a-z0-9.\-]{0,9})\b/i)
  if (removeMatch) {
    return { type: 'remove_candidate', ticker: normalizeTicker(removeMatch[1]) }
  }

  if (
    (/\b(build|create|generate)\b/.test(lower) &&
      /\b(draft|plan|strategy|mitigation)\b/.test(lower)) ||
    /\bmitigation plan\b/.test(lower)
  ) {
    return { type: 'build_draft', seedSummary: text }
  }

  if (/\b(evaluate|simulate|run|score|compare)\b/.test(lower)) {
    return { type: 'evaluate_scenario' }
  }

  return { type: 'unknown' }
}
