/**
 * Concentration thresholds for exposure warnings.
 * When a single sector/category exceeds these percentages of
 * total portfolio value, a warning is generated.
 */
export const CONCENTRATION_THRESHOLDS = {
  /** >= 10% triggers low severity */
  LOW: 10,
  /** >= 20% triggers medium severity */
  MEDIUM: 20,
  /** >= 30% triggers high severity */
  HIGH: 30,
  /** >= 40% triggers critical severity */
  CRITICAL: 40,
} as const

/** Minimum confidence score to display a causal chain edge */
export const MIN_EDGE_CONFIDENCE = 0.3

/** Maximum hops before chain is flagged as speculative */
export const MAX_NON_SPECULATIVE_HOPS = 3

/** Maximum active signal cards on Portfolio View */
export const MAX_ACTIVE_SIGNALS = 3

/** Maximum candidate signals returned by Signal Monitor */
export const MAX_SIGNAL_MONITOR_RESULTS = 5

/** Maximum push notifications per user per day */
export const MAX_DAILY_NOTIFICATIONS = 2

/** Regulatory disclaimer text (PRD Section 9) */
export const DISCLAIMER =
  'This analysis is for informational purposes only and does not constitute financial advice. ' +
  'Past performance is not indicative of future results. Causal relationships shown are ' +
  'AI-generated hypotheses, not guaranteed outcomes. Always consult a qualified financial ' +
  'advisor before making investment decisions.'
