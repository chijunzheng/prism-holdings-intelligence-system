// Fund Manager — the synthesis agent ("overall brain")
// Receives ALL outputs from prior teams, produces FundManagerVerdict.
// 5-step algorithm: debate resolution → risk adjustments → calibrate dollars → recommendations → verdict

import { HumanMessage } from '@langchain/core/messages'
import type {
  FundManagerVerdict,
  DebateResolution,
  RiskChallenge,
  MagnitudeValidation,
  StressTestResult,
  InferredRiskProfile,
  MarketDataBundle,
  CalibratedHoldingImpact,
  Recommendation,
  HoldingImpactEstimate,
  ScenarioPreference,
  UserExpectations,
  Signal,
  DollarRange,
} from '@prism/shared'
import { calibrateImpact } from './calibration.js'
import { createGeminiChatModel } from '../utils/gemini-chat-model'

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

// ── Step 1-3: Calibrate Holdings ────────────────────────────
function calibrateHoldings(params: {
  readonly debateResolution: DebateResolution
  readonly riskChallenge: RiskChallenge
  readonly magnitudeValidation: MagnitudeValidation
  readonly stressTest: StressTestResult
  readonly marketData: MarketDataBundle
  readonly holdingValues: Readonly<Record<string, number>>
  readonly holdingNames: Readonly<Record<string, string>>
  readonly scenarioPreference?: ScenarioPreference
}): readonly CalibratedHoldingImpact[] {
  const {
    debateResolution,
    riskChallenge,
    magnitudeValidation,
    marketData,
    holdingValues,
    holdingNames,
    stressTest,
    scenarioPreference,
  } = params

  // Step 1: Start from debate-refined impacts
  const refinedImpacts = debateResolution.refinedHoldingImpacts

  // Step 2: Apply magnitude validation bounds
  const boundedImpacts: HoldingImpactEstimate[] = refinedImpacts.map((impact) => {
    const validation = magnitudeValidation.holdingValidations.find(
      (v) => v.ticker === impact.ticker,
    )
    const magnitudeScore = validation?.outOfBounds
      ? validation.calibratedMagnitude
      : impact.magnitudeScore

    return { ...impact, magnitudeScore }
  })

  // Step 3: Calibrate dollar impacts per horizon
  const horizons = ['1W', '1M', '6M'] as const

  return boundedImpacts.map((impact) => {
    const holdingValueCad = holdingValues[impact.ticker] ?? 0
    const vol = marketData.volatilities[impact.ticker]?.monthly ?? 0.05

    const impactByHorizon: Record<string, DollarRange> = {}
    for (const horizon of horizons) {
      impactByHorizon[horizon] = calibrateImpact({
        holdingValueCad,
        analystDirectionConsensus: impact.direction,
        analystMagnitudeConsensus: impact.magnitudeScore,
        riskChallengeHaircut: riskChallenge.recommendedConfidenceAdjustment,
        computedVolatility: vol,
        timeHorizon: horizon,
      })
    }

    // Apply scenario preference from stress test
    if (scenarioPreference && stressTest.holdingBreakdown.length > 0) {
      const holdingStress = stressTest.holdingBreakdown.find(
        (h) => h.ticker === impact.ticker,
      )
      if (holdingStress) {
        const stressMultiplier = scenarioPreference === 'downside'
          ? holdingStress.downsideImpact / (holdingStress.baseImpact || 1)
          : scenarioPreference === 'tail'
            ? holdingStress.tailImpact / (holdingStress.baseImpact || 1)
            : 1

        if (isFinite(stressMultiplier) && stressMultiplier !== 0) {
          for (const horizon of horizons) {
            const adj = impactByHorizon[horizon]
            impactByHorizon[horizon] = {
              low: Math.round(adj.low * Math.abs(stressMultiplier)),
              mid: Math.round(adj.mid * Math.abs(stressMultiplier)),
              high: Math.round(adj.high * Math.abs(stressMultiplier)),
            }
          }
        }
      }
    }

    const volSource = marketData.volatilities[impact.ticker] ? 'Yahoo Finance' : 'fallback'
    const derivation =
      `$${holdingValueCad.toLocaleString()} × ${(impact.magnitudeScore * 100).toFixed(0)}% magnitude × ` +
      `${impact.direction > 0 ? '+' : ''}${impact.direction.toFixed(2)} direction. ` +
      `Vol: ${(vol * 100).toFixed(1)}% monthly (${volSource}). ` +
      `Haircut: ${(riskChallenge.recommendedConfidenceAdjustment * 100).toFixed(0)}%.`

    return {
      ticker: impact.ticker,
      name: holdingNames[impact.ticker] ?? impact.name,
      holdingValueCad,
      direction: impact.direction,
      impact: impactByHorizon,
      confidence: Math.max(0, Math.min(1,
        debateResolution.consensusConfidence * (1 + riskChallenge.recommendedConfidenceAdjustment),
      )),
      derivation,
    }
  })
}

// ── Step 4: Generate Recommendations ────────────────────────
async function generateRecommendations(params: {
  readonly calibratedImpacts: readonly CalibratedHoldingImpact[]
  readonly riskProfile: InferredRiskProfile
  readonly debateResolution: DebateResolution
  readonly stressTest: StressTestResult
  readonly userExpectations?: UserExpectations
  readonly signal: Signal
}): Promise<readonly Recommendation[]> {
  const { calibratedImpacts, riskProfile, debateResolution, stressTest, signal } = params

  const totalMid = calibratedImpacts.reduce(
    (sum, h) => sum + (h.impact['1M']?.mid ?? 0),
    0,
  )

  const model = createGeminiChatModel({
    model: 'gemini-2.5-flash',
    temperature: 0.3,
    maxOutputTokens: 2048,
  })

  const prompt = `You are a Fund Manager generating recommendation options for a portfolio.

SIGNAL: ${signal.headline}
DEBATE OUTCOME: ${debateResolution.consensusDirection} (confidence: ${debateResolution.consensusConfidence.toFixed(2)})
TOTAL 1-MONTH IMPACT: $${totalMid.toLocaleString()} CAD
STRESS TEST: Base: $${stressTest.baseCase.mid}, Downside: $${stressTest.downside.mid}, Tail: $${stressTest.tailRisk.mid}
RISK TOLERANCE: ${riskProfile.riskTolerance} (score: ${riskProfile.riskScore}/100)

Generate exactly 3 recommendation options as JSON array:
1. "Do nothing" — accept the risk. Cost: $0. Show the estimated cost of inaction.
2. Light protection — minimal intervention appropriate for this risk level.
3. Balanced response — moderate protection.

For ${riskProfile.riskTolerance} risk tolerance, ${riskProfile.riskTolerance === 'high' ? 'be more relaxed about smaller risks' : riskProfile.riskTolerance === 'low' ? 'emphasize protection even for moderate risks' : 'balance cost and protection'}.

Each option needs: id, title, description, estimatedCost, riskReduction, tradeoffs[], isDoNothing.
Use plain English. Dollar amounts, not percentages.

Respond with a JSON array:
[
  { "id": "do-nothing", "title": "Do nothing", "description": "...", "estimatedCost": "$0", "riskReduction": "None — accept ~$${Math.abs(totalMid)} risk", "tradeoffs": ["..."], "isDoNothing": true },
  { "id": "light", "title": "...", "description": "...", "estimatedCost": "...", "riskReduction": "...", "tradeoffs": ["..."], "isDoNothing": false },
  { "id": "balanced", "title": "...", "description": "...", "estimatedCost": "...", "riskReduction": "...", "tradeoffs": ["..."], "isDoNothing": false }
]`

  const response = await model.invoke([new HumanMessage(prompt)])
  const responseText = typeof response.content === 'string'
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
      : ''

  try {
    const parsed = JSON.parse(extractJson(responseText)) as Recommendation[]
    return parsed
  } catch {
    // Fallback recommendations if LLM fails
    return [
      {
        id: 'do-nothing',
        title: 'Do nothing',
        description: `Accept the estimated ${totalMid < 0 ? 'loss' : 'impact'} of ~$${Math.abs(totalMid).toLocaleString()}.`,
        estimatedCost: '$0',
        riskReduction: `None — accept ~$${Math.abs(totalMid).toLocaleString()} risk`,
        tradeoffs: ['No cost', 'Full exposure to the risk'],
        isDoNothing: true,
      },
      {
        id: 'light',
        title: 'Light protection',
        description: 'Reduce exposure to the most affected holdings.',
        estimatedCost: '~$200-500',
        riskReduction: `Reduces risk by ~$${Math.round(Math.abs(totalMid) * 0.4).toLocaleString()}`,
        tradeoffs: ['Lower cost', 'Partial protection only'],
        isDoNothing: false,
      },
      {
        id: 'balanced',
        title: 'Balanced response',
        description: 'Hedge the primary exposure and add defensive positions.',
        estimatedCost: '~$500-1,200',
        riskReduction: `Reduces risk by ~$${Math.round(Math.abs(totalMid) * 0.7).toLocaleString()}`,
        tradeoffs: ['Higher upfront cost', 'Better protection', 'May miss upside if reversal occurs'],
        isDoNothing: false,
      },
    ]
  }
}

// ── Public API ──────────────────────────────────────────────
export async function runFundManager(params: {
  readonly signal: Signal
  readonly debateResolution: DebateResolution
  readonly riskChallenge: RiskChallenge
  readonly magnitudeValidation: MagnitudeValidation
  readonly stressTest: StressTestResult
  readonly riskProfile: InferredRiskProfile
  readonly marketData: MarketDataBundle
  readonly holdingValues: Readonly<Record<string, number>>
  readonly holdingNames: Readonly<Record<string, string>>
  readonly userExpectations?: UserExpectations
  readonly scenarioPreference?: ScenarioPreference
  readonly judgeFeedback?: string
}): Promise<FundManagerVerdict> {
  const {
    signal,
    debateResolution,
    riskChallenge,
    magnitudeValidation,
    stressTest,
    riskProfile,
    marketData,
    holdingValues,
    holdingNames,
    userExpectations,
    scenarioPreference,
  } = params

  // Steps 1-3: Calibrate all holding impacts
  const calibratedImpacts = calibrateHoldings({
    debateResolution,
    riskChallenge,
    magnitudeValidation,
    stressTest,
    marketData,
    holdingValues,
    holdingNames,
    scenarioPreference,
  })

  // Step 4: Generate recommendations
  const recommendations = await generateRecommendations({
    calibratedImpacts,
    riskProfile,
    debateResolution,
    stressTest,
    userExpectations,
    signal,
  })

  // Step 5: Assemble verdict
  const magnitudeBoundsApplied = magnitudeValidation.holdingValidations
    .filter((v) => v.outOfBounds)
    .map((v) => `${v.ticker}: clamped from ${(v.estimatedMagnitude * 100).toFixed(1)}% to ${(v.calibratedMagnitude * 100).toFixed(1)}%`)

  return {
    signalId: signal.id,
    holdingImpacts: [...calibratedImpacts],
    recommendations: [...recommendations],
    riskAdjustments: {
      confidenceHaircut: riskChallenge.recommendedConfidenceAdjustment,
      magnitudeBoundsApplied,
      scenarioPreference: scenarioPreference ?? 'base',
    },
    perspectiveBreakdown: {
      bullCase: debateResolution.debateTranscript
        .filter((a) => a.round === 1 && a.keyPoints.length > 0)
        .map((a) => a.keyPoints.join('. '))
        .join(' ') || 'See debate transcript.',
      bearCase: debateResolution.debateTranscript
        .filter((a) => a.round === 1 && a.rebuttalPoints.length > 0)
        .map((a) => a.rebuttalPoints.join('. '))
        .join(' ') || 'See debate transcript.',
      unresolvedDisagreements: [...debateResolution.unresolvedDisagreements],
    },
    qualityScore: debateResolution.consensusConfidence,
    humanDecisionRequired: true,
  }
}
