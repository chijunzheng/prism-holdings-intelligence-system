import type {
  FundManagerVerdict,
  Recommendation,
  ResearchBrief,
  Signal,
} from '@prism/shared'
import type {
  ActionPlaybookData,
  ReasoningTraceData,
  ReasoningTraceStep,
  SignalImpactDeltaData,
  TraceNavigatorData,
} from './types'

function parseRiskReductionMagnitude(riskReduction: string): number {
  const numbers = riskReduction.match(/-?\d[\d,]*/g)
  if (!numbers || numbers.length === 0) return 0
  const value = Number(numbers[0].replace(/,/g, ''))
  return Number.isFinite(value) ? Math.abs(value) : 0
}

function pickRecommendedRecommendation(
  recommendations: readonly Recommendation[],
): Recommendation | null {
  const actionable = recommendations.filter((rec) => !rec.isDoNothing)
  if (actionable.length === 0) return recommendations[0] ?? null

  return [...actionable].sort((a, b) => {
    const magnitudeDiff =
      parseRiskReductionMagnitude(b.riskReduction) - parseRiskReductionMagnitude(a.riskReduction)
    if (magnitudeDiff !== 0) return magnitudeDiff
    return a.estimatedCost.localeCompare(b.estimatedCost)
  })[0]
}

export function buildPlaybookSteps(rec: Recommendation): ActionPlaybookData['steps'] {
  const steps = [
    {
      id: 'confirm-scope',
      title: `Confirm exposure scope for "${rec.title}"`,
      detail: 'Review the affected holdings and verify this action aligns with your short-term liquidity needs.',
    },
    {
      id: 'execute-adjustment',
      title: 'Apply the portfolio adjustment manually',
      detail: rec.description,
    },
    {
      id: 'validate-outcome',
      title: 'Re-run analysis after execution',
      detail: 'Validate that projected risk reduction is reflected in updated signal impact outputs.',
    },
  ]

  return steps
}

export function mapImpactDeltaData(
  signal: Signal,
  verdict: FundManagerVerdict,
): SignalImpactDeltaData {
  const impacts = verdict.holdingImpacts
    .map((holding) => {
      const oneMonthImpact = holding.impact['1M'] ?? holding.impact['1W'] ?? holding.impact['6M']
      return {
        ticker: holding.ticker,
        name: holding.name,
        impactMidCad: oneMonthImpact?.mid ?? 0,
        confidence: holding.confidence,
      }
    })
    .sort((a, b) => Math.abs(b.impactMidCad) - Math.abs(a.impactMidCad))

  const netImpactMidCad = impacts.reduce((sum, item) => sum + item.impactMidCad, 0)
  const topHoldings = impacts.slice(0, 5)

  return {
    signalId: signal.id,
    signalHeadline: signal.headline,
    summary: `Projected 1M net impact: $${Math.round(netImpactMidCad).toLocaleString()} across top affected holdings.`,
    netImpactMidCad,
    affectedHoldings: topHoldings,
  }
}

export function mapActionPlaybookData(
  signal: Signal,
  verdict: FundManagerVerdict,
): ActionPlaybookData | null {
  const recommended = pickRecommendedRecommendation(verdict.recommendations)
  if (!recommended) return null

  return {
    signalId: signal.id,
    recommendationId: recommended.id,
    title: recommended.title,
    rationale: recommended.description,
    estimatedCost: recommended.estimatedCost,
    riskReduction: recommended.riskReduction,
    tradeoffs: recommended.tradeoffs,
    steps: buildPlaybookSteps(recommended),
    alternatives: verdict.recommendations.filter((rec) => rec.id !== recommended.id),
    ...(recommended.actions ? { actions: recommended.actions } : {}),
  }
}

export function mapReasoningTraceData(params: {
  readonly signal: Signal
  readonly verdict: FundManagerVerdict
  readonly researchBrief?: ResearchBrief
  readonly intermediateArtifacts?: {
    readonly riskProfile: ReasoningTraceData['riskProfile']
    readonly analystAssessments: ReasoningTraceData['analystAssessments']
    readonly debateResolution: ReasoningTraceData['debateResolution']
    readonly riskChallenge: ReasoningTraceData['riskChallenge']
    readonly magnitudeValidation: ReasoningTraceData['magnitudeValidation']
    readonly stressTest: ReasoningTraceData['stressTest']
  }
  readonly steps?: readonly ReasoningTraceStep[]
}): ReasoningTraceData {
  const { signal, verdict, researchBrief, intermediateArtifacts, steps = [] } = params
  const summary = researchBrief?.sections[0]?.content ??
    `Quality score ${verdict.qualityScore.toFixed(2)} with ${
      verdict.holdingImpacts.length
    } calibrated holding impacts.`

  return {
    signalId: signal.id,
    signalHeadline: signal.headline,
    summary,
    riskProfile: intermediateArtifacts?.riskProfile,
    analystAssessments: intermediateArtifacts?.analystAssessments,
    debateResolution: intermediateArtifacts?.debateResolution,
    riskChallenge: intermediateArtifacts?.riskChallenge,
    magnitudeValidation: intermediateArtifacts?.magnitudeValidation,
    stressTest: intermediateArtifacts?.stressTest,
    steps,
  }
}

export function mapTraceNavigatorData(params: {
  readonly signal: Signal
  readonly steps: readonly ReasoningTraceStep[]
  readonly totalSteps?: number
}): TraceNavigatorData {
  const totalSteps = params.totalSteps ?? 10
  return {
    signalId: params.signal.id,
    signalHeadline: params.signal.headline,
    completedSteps: params.steps.length,
    totalSteps,
    steps: params.steps,
  }
}
