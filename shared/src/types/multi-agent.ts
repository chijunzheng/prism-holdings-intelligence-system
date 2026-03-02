import { z } from 'zod'

// ── Dollar Impact Range ──────────────────────────────────────
export const DollarRangeSchema = z.object({
  low: z.number(),
  mid: z.number(),
  high: z.number(),
})
export type DollarRange = z.infer<typeof DollarRangeSchema>

// ── Time Horizons ────────────────────────────────────────────
export const TimeHorizon = z.enum(['1W', '1M', '6M'])
export type TimeHorizon = z.infer<typeof TimeHorizon>

// ── Direction ────────────────────────────────────────────────
export const Direction = z.enum(['positive', 'negative', 'neutral', 'mixed'])
export type Direction = z.infer<typeof Direction>

// ── Holding Impact Estimate ──────────────────────────────────
export const HoldingImpactEstimateSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  direction: z.number().min(-1).max(1),
  magnitudeScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  dollarImpact: z.record(TimeHorizon, DollarRangeSchema).optional(),
  reasoning: z.string().optional(),
})
export type HoldingImpactEstimate = z.infer<typeof HoldingImpactEstimateSchema>

// ── Analyst Assessment ───────────────────────────────────────
export const AnalystType = z.enum(['macro', 'fundamental', 'sentiment', 'technical'])
export type AnalystType = z.infer<typeof AnalystType>

export const AnalystAssessmentSchema = z.object({
  analystType: AnalystType,
  overallDirection: Direction,
  overallConfidence: z.number().min(0).max(1),
  holdingImpacts: z.array(HoldingImpactEstimateSchema),
  keyAssumptions: z.array(z.string()).min(2),
  evidenceSources: z.array(z.string()).min(1),
  reasoning: z.string(),
})
export type AnalystAssessment = z.infer<typeof AnalystAssessmentSchema>

// ── Debate Types ─────────────────────────────────────────────
export const DebateArgumentSchema = z.object({
  position: Direction,
  round: z.number().int().positive(),
  keyPoints: z.array(z.string()),
  evidenceCited: z.array(z.string()),
  rebuttalPoints: z.array(z.string()),
  concessions: z.array(z.string()),
})
export type DebateArgument = z.infer<typeof DebateArgumentSchema>

export const DebateResolutionSchema = z.object({
  signalId: z.string(),
  rounds: z.number().int().positive(),
  consensusDirection: Direction,
  consensusMagnitude: z.number().min(0).max(1),
  consensusConfidence: z.number().min(0).max(1),
  bullConcessions: z.array(z.string()),
  bearConcessions: z.array(z.string()),
  unresolvedDisagreements: z.array(z.string()),
  refinedHoldingImpacts: z.array(HoldingImpactEstimateSchema),
  debateTranscript: z.array(DebateArgumentSchema),
})
export type DebateResolution = z.infer<typeof DebateResolutionSchema>

// ── Risk Challenge ───────────────────────────────────────────
export const ChallengedAssumptionSchema = z.object({
  analystType: AnalystType,
  assumption: z.string(),
  counterEvidence: z.string(),
  likelihoodOfBeingWrong: z.number().min(0).max(1),
})
export type ChallengedAssumption = z.infer<typeof ChallengedAssumptionSchema>

export const RiskChallengeSchema = z.object({
  challengedAssumptions: z.array(ChallengedAssumptionSchema),
  recommendedConfidenceAdjustment: z.number().min(-0.5).max(0),
  overallAssessment: z.string(),
})
export type RiskChallenge = z.infer<typeof RiskChallengeSchema>

// ── Magnitude Validation ─────────────────────────────────────
export const HoldingValidationSchema = z.object({
  ticker: z.string(),
  estimatedMagnitude: z.number(),
  historicalVolatility: z.number(),
  maxReasonableMove: z.number(),
  outOfBounds: z.boolean(),
  calibratedMagnitude: z.number(),
})
export type HoldingValidation = z.infer<typeof HoldingValidationSchema>

export const MagnitudeValidationSchema = z.object({
  holdingValidations: z.array(HoldingValidationSchema),
  outOfBoundsFlags: z.array(z.string()),
  overallAssessment: z.string(),
})
export type MagnitudeValidation = z.infer<typeof MagnitudeValidationSchema>

// ── Stress Test ──────────────────────────────────────────────
export const StressScenarioSchema = z.object({
  name: z.string(),
  percentile: z.number().min(0).max(100),
  portfolioImpact: DollarRangeSchema,
  description: z.string(),
})
export type StressScenario = z.infer<typeof StressScenarioSchema>

export const StressTestResultSchema = z.object({
  numSimulations: z.number().int().positive(),
  baseCase: DollarRangeSchema,
  downside: DollarRangeSchema,
  tailRisk: DollarRangeSchema,
  reversalProbability: z.number().min(0).max(1),
  scenarios: z.array(StressScenarioSchema),
  holdingBreakdown: z.array(z.object({
    ticker: z.string(),
    baseImpact: z.number(),
    downsideImpact: z.number(),
    tailImpact: z.number(),
  })),
})
export type StressTestResult = z.infer<typeof StressTestResultSchema>

// ── Judge Verdict ────────────────────────────────────────────
export const JudgeVerdictSchema = z.object({
  evidenceGrounding: z.number().min(0).max(1),
  assumptionQuality: z.number().min(0).max(1),
  magnitudeCalibration: z.number().min(0).max(1),
  internalConsistency: z.number().min(0).max(1),
  completeness: z.number().min(0).max(1),
  overallQualityScore: z.number().min(0).max(1),
  convergenceReached: z.boolean(),
  feedback: z.string().optional(),
})
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>

// ── Recommendation Action (ticker-level adjustments) ─────────
export const RecommendationActionSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  action: z.enum(['reduce', 'increase', 'hold', 'add_new', 'remove']),
  currentValueCad: z.number().optional(),
  suggestedChangePct: z.number().optional(),
  suggestedChangeCad: z.number().optional(),
  rationale: z.string(),
})
export type RecommendationAction = z.infer<typeof RecommendationActionSchema>

// ── Recommendation ───────────────────────────────────────────
export const RecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  estimatedCost: z.string(),
  riskReduction: z.string(),
  tradeoffs: z.array(z.string()),
  isDoNothing: z.boolean(),
  actions: z.array(RecommendationActionSchema).optional(),
})
export type Recommendation = z.infer<typeof RecommendationSchema>

// ── Calibrated Holding Impact ────────────────────────────────
export const CalibratedHoldingImpactSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  holdingValueCad: z.number(),
  direction: z.number().min(-1).max(1),
  impact: z.record(TimeHorizon, DollarRangeSchema),
  confidence: z.number().min(0).max(1),
  derivation: z.string(),
})
export type CalibratedHoldingImpact = z.infer<typeof CalibratedHoldingImpactSchema>

// ── Fund Manager Verdict ─────────────────────────────────────
export const FundManagerVerdictSchema = z.object({
  signalId: z.string(),
  holdingImpacts: z.array(CalibratedHoldingImpactSchema),
  recommendations: z.array(RecommendationSchema),
  riskAdjustments: z.object({
    confidenceHaircut: z.number(),
    magnitudeBoundsApplied: z.array(z.string()),
    scenarioPreference: z.string(),
  }),
  perspectiveBreakdown: z.object({
    bullCase: z.string(),
    bearCase: z.string(),
    unresolvedDisagreements: z.array(z.string()),
  }),
  qualityScore: z.number().min(0).max(1),
  humanDecisionRequired: z.literal(true),
})
export type FundManagerVerdict = z.infer<typeof FundManagerVerdictSchema>

// ── Inferred Risk Profile ────────────────────────────────────
export const RiskFactorSchema = z.object({
  factor: z.string(),
  signal: z.string(),
  scoreEffect: z.number(),
})
export type RiskFactor = z.infer<typeof RiskFactorSchema>

export const InferredRiskProfileSchema = z.object({
  riskScore: z.number().min(0).max(100),
  riskTolerance: z.enum(['low', 'moderate', 'high']),
  factors: z.array(RiskFactorSchema),
  reasoning: z.string(),
  declaredTolerance: z.enum(['low', 'moderate', 'high']).optional(),
  mismatch: z.object({
    detected: z.boolean(),
    explanation: z.string(),
  }).optional(),
  warnings: z.array(z.string()),
})
export type InferredRiskProfile = z.infer<typeof InferredRiskProfileSchema>

// ── Portfolio Verdict (Cross-Signal Synthesis) ───────────────
export const HoldingNetImpactSchema = z.object({
  holdingTicker: z.string(),
  holdingName: z.string(),
  signalContributions: z.array(z.object({
    signalId: z.string(),
    impact: DollarRangeSchema,
  })),
  interaction: z.enum(['offsetting', 'compounding', 'independent']),
  netImpact: DollarRangeSchema,
  grossImpact: DollarRangeSchema,
})
export type HoldingNetImpact = z.infer<typeof HoldingNetImpactSchema>

export const PortfolioVerdictSchema = z.object({
  signals: z.array(z.object({
    signalId: z.string(),
    headline: z.string(),
    individualVerdict: FundManagerVerdictSchema,
  })),
  holdingNetImpacts: z.array(HoldingNetImpactSchema),
  portfolioNetImpact: DollarRangeSchema,
  portfolioGrossImpact: DollarRangeSchema,
  keyInsights: z.array(z.string()),
  recommendations: z.array(RecommendationSchema),
  interactionSummary: z.string(),
  humanDecisionRequired: z.literal(true),
})
export type PortfolioVerdict = z.infer<typeof PortfolioVerdictSchema>

// ── Research Brief ───────────────────────────────────────────
export const ResearchBriefSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
})
export type ResearchBriefSection = z.infer<typeof ResearchBriefSectionSchema>

export const ResearchBriefSchema = z.object({
  signalId: z.string(),
  generatedAt: z.string(),
  qualityScore: z.number().min(0).max(1),
  impactRange: DollarRangeSchema,
  sections: z.array(ResearchBriefSectionSchema),
  sources: z.array(z.object({
    index: z.number(),
    description: z.string(),
    url: z.string().optional(),
  })),
  fullText: z.string(),
  disclaimer: z.string(),
})
export type ResearchBrief = z.infer<typeof ResearchBriefSchema>

// ── Market Data Types ────────────────────────────────────────
export const VolatilityDataSchema = z.object({
  daily: z.number(),
  monthly: z.number(),
  annualized: z.number(),
})
export type VolatilityData = z.infer<typeof VolatilityDataSchema>

export const MarketDataBundleSchema = z.object({
  tickers: z.array(z.string()),
  volatilities: z.record(z.string(), VolatilityDataSchema),
  correlationMatrix: z.array(z.array(z.number())),
  fetchedAt: z.string(),
  source: z.enum(['yahoo_finance', 'fallback']),
})
export type MarketDataBundle = z.infer<typeof MarketDataBundleSchema>

// ── Pipeline State Types ─────────────────────────────────────
export const ScenarioPreference = z.enum(['base', 'downside', 'tail'])
export type ScenarioPreference = z.infer<typeof ScenarioPreference>
