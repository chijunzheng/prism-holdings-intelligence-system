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

// ── Q&A Ground Truth Dataset ───────────────────────────────
export interface GroundTruthAnswer {
  readonly overallDirection: 'positive' | 'negative' | 'neutral'
  readonly perTickerDirection: Readonly<Record<string, 'positive' | 'negative' | 'neutral'>>
  readonly rationale: string
  readonly sourceUrl: string
}

export interface QaExample {
  readonly id: string
  readonly type: EventType
  readonly date: string // YYYY-MM-DD
  readonly query: string
  readonly eventDescription: string
  readonly sourceUrl: string
  readonly actualReturns5d: Readonly<Record<string, number>>
  readonly groundedAnswer: GroundTruthAnswer
}

// ── System Keys ─────────────────────────────────────────────
export type SystemKey = 'multiAgent' | 'singleAgent' | 'pro25SingleAgent' | 'tradingAgents'

// ── LLM-as-Judge Quality Scores ────────────────────────────
export interface JudgeScore {
  readonly causalReasoning: number      // 0-5
  readonly calibration: number          // 0-5
  readonly riskIdentification: number   // 0-5
  readonly recommendationQuality: number // 0-5
  readonly transparency: number         // 0-5
  readonly overall: number              // average of above
}

// ── Baseline Result (shared shape for single-agent systems) ─
export interface BaselineResult {
  readonly direction: 'positive' | 'negative' | 'mixed'
  readonly dollarImpactRange: { readonly low: number; readonly high: number }
  readonly holdingDirections: ReadonlyMap<string, number>
  readonly reasoning: string
  readonly judgeScore?: JudgeScore
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
    readonly reasoning: string
    readonly judgeScore?: JudgeScore
  }
  readonly singleAgent: BaselineResult
  readonly pro25SingleAgent: BaselineResult
  readonly tradingAgents: BaselineResult
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
  readonly averageJudgeScore?: JudgeScore
}

export interface EvalReport {
  readonly timestamp: string
  readonly eventCount: number
  readonly multiAgent: SystemMetrics
  readonly singleAgent: Omit<SystemMetrics, 'evidenceGrounding'>
  readonly pro25SingleAgent: Omit<SystemMetrics, 'evidenceGrounding'>
  readonly tradingAgents: Omit<SystemMetrics, 'evidenceGrounding'>
  readonly results: readonly EvalResult[]
}
