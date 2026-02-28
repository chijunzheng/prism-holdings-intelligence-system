// Evaluation harness types — historical event format and metrics.
// No external dependencies — eval runs standalone outside workspace packages.

// ── Event Type Categories ──────────────────────────────────
export type EventType =
  | 'rate_decision'
  | 'cpi_surprise'
  | 'oil_shock'
  | 'banking_stress'
  | 'geopolitical'
  | 'currency_fx'

export const EVENT_TYPES: readonly EventType[] = [
  'rate_decision',
  'cpi_surprise',
  'oil_shock',
  'banking_stress',
  'geopolitical',
  'currency_fx',
]

// ── Historical Event (ground truth) ────────────────────────
export interface HistoricalEvent {
  readonly id: string
  readonly type: EventType
  readonly date: string // YYYY-MM-DD
  readonly description: string
  readonly sourceUrl: string
  /** Actual 5-day cumulative returns per ETF after the event */
  readonly actualReturns5d: Readonly<Record<string, number>>
}

// ── Per-Event Evaluation Result ────────────────────────────
export interface EvalResult {
  readonly eventId: string
  readonly eventType: EventType
  readonly multiAgent: {
    readonly direction: 'positive' | 'negative' | 'mixed'
    readonly dollarImpactRange: { readonly low: number; readonly high: number }
    readonly holdingDirections: ReadonlyMap<string, number>
    readonly qualityScore: number
    readonly evidenceGroundingScore?: number
  }
  readonly singleAgent: {
    readonly direction: 'positive' | 'negative' | 'mixed'
    readonly dollarImpactRange: { readonly low: number; readonly high: number }
    readonly holdingDirections: ReadonlyMap<string, number>
  }
  readonly actual: {
    readonly returns5d: Readonly<Record<string, number>>
    readonly netDirection: 'positive' | 'negative' | 'neutral'
  }
}

// ── Aggregated Metrics ─────────────────────────────────────
export interface SystemMetrics {
  readonly directionalAccuracy: number // 0-1
  readonly rangeCoverage: number // 0-1
  readonly evidenceGrounding: number // 0-1 (multi-agent only)
  readonly perEventType: ReadonlyMap<EventType, { accuracy: number; coverage: number }>
}

export interface EvalReport {
  readonly timestamp: string
  readonly eventCount: number
  readonly multiAgent: SystemMetrics
  readonly singleAgent: Omit<SystemMetrics, 'evidenceGrounding'>
  readonly results: readonly EvalResult[]
}
