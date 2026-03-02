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
import type { ThinkingCallback } from './types.js'
import { z } from 'zod'
import { calibrateImpact } from './calibration.js'
import { createGeminiChatModel } from '../utils/gemini-chat-model'
import { parseJsonSafe } from '../utils/json-parse.js'

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
        consensusConfidence: debateResolution.consensusConfidence,
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
    const conf = debateResolution.consensusConfidence
    const confLabel = conf >= 0.7 ? 'high' : conf >= 0.4 ? 'moderate' : 'low'
    const rangeLabel = conf >= 0.7 ? 'tight bounds' : conf >= 0.4 ? 'moderate bounds' : 'wide bounds'
    const challengeCount = riskChallenge.challengedAssumptions.length
    const dirLabel = debateResolution.consensusDirection === 'negative' ? 'Bearish'
      : debateResolution.consensusDirection === 'positive' ? 'Bullish'
        : debateResolution.consensusDirection === 'mixed' ? 'Mixed' : 'Neutral'
    const derivation =
      `${dirLabel} (${confLabel} confidence, ${challengeCount} assumptions challenged). ` +
      `$${holdingValueCad.toLocaleString()} × ${(impact.magnitudeScore * 100).toFixed(0)}% magnitude × ` +
      `${impact.direction > 0 ? '+' : ''}${impact.direction.toFixed(2)} direction. ` +
      `Vol: ${(vol * 100).toFixed(1)}% monthly (${volSource}). ` +
      `Haircut: ${(riskChallenge.recommendedConfidenceAdjustment * 100).toFixed(0)}%. ` +
      `Range: ${rangeLabel} (${confLabel} debate confidence).`

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
    model: 'gemini-3-flash-preview',
    temperature: 0.3,
    maxOutputTokens: 4096,
  })

  const holdingSummary = calibratedImpacts
    .map((h) => `${h.ticker} (${h.name}): value $${h.holdingValueCad.toLocaleString()}, 1M impact: $${h.impact['1M']?.mid ?? 0}`)
    .join('\n  ')

  // Sort by impact magnitude for concrete examples in prompt
  const sorted = [...calibratedImpacts].sort((a, b) =>
    Math.abs(b.impact['1M']?.mid ?? 0) - Math.abs(a.impact['1M']?.mid ?? 0),
  )
  const topNeg = sorted.filter((h) => (h.impact['1M']?.mid ?? 0) < 0)
  const topPos = sorted.filter((h) => (h.impact['1M']?.mid ?? 0) >= 0)

  // Build concrete action examples from the actual holdings
  const exampleLight = topNeg.slice(0, 1).map((h) => {
    const reducePct = 15
    const reduceCad = Math.round(h.holdingValueCad * reducePct / 100)
    return `{ "ticker": "${h.ticker}", "name": "${h.name}", "action": "reduce", "currentValueCad": ${h.holdingValueCad}, "suggestedChangePct": -${reducePct}, "suggestedChangeCad": -${reduceCad}, "rationale": "Trim most exposed position to limit downside" }`
  }).join(',\n      ')

  // Detect whether this is a user question about a specific action (e.g. "should I buy NVDA?")
  // vs a market event they want protection from (e.g. "Fed raises rates 50bps")
  const isUserQuery = signal.headline.startsWith('User scenario:')
  const signalText = isUserQuery
    ? signal.headline.replace('User scenario: ', '')
    : signal.headline

  const queryGuidance = isUserQuery
    ? `The user asked: "${signalText}"
Your recommendations MUST directly answer this question. Do NOT default to generic hedging/diversification.
- If they ask "should I buy X?", options should be about buying/not buying X at different sizes.
- If they ask "should I sell X?", options should be about selling/not selling X.
- If they ask about a scenario, options should address that specific scenario.
- Always ground recommendations in the debate outcome and calibrated impacts above.

Option 1 — "Do nothing": Keep current portfolio unchanged. isDoNothing: true. No actions array. Describe what happens if they don't act.
Option 2 — Conservative approach: A cautious version of the action the user is considering (e.g. small position, partial sell). 2-3 trades.
Option 3 — Conviction approach: A bolder version based on the analysis outcome (e.g. larger position, full rebalancing around the thesis). 4-6 trades.`
    : `This is a market event signal. Generate protective recommendations.

Option 1 — "Do nothing": accept the estimated impact. isDoNothing: true. No actions array.
Option 2 — Light protection: 2-3 trades — trim the most exposed holdings AND add at least 1 defensive position (gold ETF like CGL.C, bond ETF like XBB, or high-interest savings ETF like CASH.TO).
Option 3 — Balanced response: 4-6 trades — reduce exposed positions, increase any positively impacted holdings, and add 2-3 defensive instruments (mix of bonds, gold, cash, or inverse ETFs).`

  const prompt = `You are a Fund Manager generating recommendation options for a retail portfolio.

SIGNAL: ${signalText}
DEBATE OUTCOME: ${debateResolution.consensusDirection} (confidence: ${debateResolution.consensusConfidence.toFixed(2)})
TOTAL 1-MONTH IMPACT: $${totalMid.toLocaleString()} CAD
STRESS TEST: Base: $${stressTest.baseCase.mid}, Downside: $${stressTest.downside.mid}, Tail: $${stressTest.tailRisk.mid}
RISK TOLERANCE: ${riskProfile.riskTolerance} (score: ${riskProfile.riskScore}/100)

HOLDINGS (current portfolio):
  ${holdingSummary}

Generate exactly 3 JSON recommendation objects. CRITICAL: options 2 and 3 MUST include an "actions" array with specific ticker-level trades.

${queryGuidance}

For ${riskProfile.riskTolerance} risk tolerance, ${riskProfile.riskTolerance === 'high' ? 'lean into conviction when analysis supports it' : riskProfile.riskTolerance === 'low' ? 'emphasize capital preservation in all options' : 'balance opportunity and protection'}.

REQUIRED FIELDS per recommendation: id, title, description, estimatedCost (string like "~$500"), riskReduction (string), tradeoffs (string[]), isDoNothing (boolean).
REQUIRED FIELDS per action (in "actions" array): ticker (string), name (string), action ("reduce"|"increase"|"hold"|"add_new"|"remove"), currentValueCad (number, current holding value or 0 for new), suggestedChangePct (number, e.g. -20 for 20% reduction), suggestedChangeCad (number, dollar amount of change), rationale (string, 1 sentence why).

EXAMPLE — actions format:
  [
      ${exampleLight}
  ]

${topPos.length > 0 ? `Note: ${topPos.map((h) => h.ticker).join(', ')} ${topPos.length === 1 ? 'is' : 'are'} positively impacted by this signal.` : ''}

Respond ONLY with a JSON array of 3 objects. No markdown, no explanation. The "actions" array is MANDATORY for options 2 and 3.`

  try {
    const response = await model.invoke([new HumanMessage(prompt)])
    const responseText = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
        : ''

    if (!responseText.trim()) {
      throw new Error('Empty response from Gemini')
    }

    const rawParsed = parseJsonSafe(responseText)
    // Guard: if LLM returned a single object, wrap in array
    const raw: Record<string, unknown>[] = Array.isArray(rawParsed) ? rawParsed : [rawParsed]

    // Lenient action parsing: fill missing optional fields instead of dropping entire array
    const lenientActionSchema = z.object({
      ticker: z.string(),
      name: z.string().default(''),
      action: z.enum(['reduce', 'increase', 'hold', 'add_new', 'remove']),
      currentValueCad: z.number().optional(),
      suggestedChangePct: z.number().optional(),
      suggestedChangeCad: z.number().optional(),
      rationale: z.string().default('See recommendation description'),
    })
    const lenientActionsSchema = z.array(lenientActionSchema)

    const parsed: Recommendation[] = raw.map((rec) => {
      const actionsResult = lenientActionsSchema.safeParse(rec.actions)
      return {
        id: String(rec.id ?? ''),
        title: String(rec.title ?? ''),
        description: String(rec.description ?? ''),
        estimatedCost: String(rec.estimatedCost ?? '$0'),
        riskReduction: String(rec.riskReduction ?? ''),
        tradeoffs: Array.isArray(rec.tradeoffs) ? rec.tradeoffs.map(String) : [],
        isDoNothing: Boolean(rec.isDoNothing),
        ...(actionsResult.success && actionsResult.data.length > 0 ? { actions: actionsResult.data } : {}),
      }
    })

    if (parsed.length === 0) {
      throw new Error('Parsed 0 recommendations from LLM response')
    }

    return parsed
  } catch (error) {
    // Fallback recommendations with derived actions from calibrated impacts
    console.error('[FundManager] generateRecommendations failed, using computed fallback:', error instanceof Error ? error.message : error)

    const negHoldings = [...calibratedImpacts]
      .filter((h) => (h.impact['1M']?.mid ?? 0) < 0)
      .sort((a, b) => (a.impact['1M']?.mid ?? 0) - (b.impact['1M']?.mid ?? 0))
    const posHoldings = [...calibratedImpacts]
      .filter((h) => (h.impact['1M']?.mid ?? 0) > 0)
      .sort((a, b) => (b.impact['1M']?.mid ?? 0) - (a.impact['1M']?.mid ?? 0))

    // For user queries, generate query-relevant fallback options
    if (isUserQuery) {
      // Find the most impacted holding (likely the one the user is asking about)
      const allSorted = [...calibratedImpacts].sort(
        (a, b) => Math.abs(b.impact['1M']?.mid ?? 0) - Math.abs(a.impact['1M']?.mid ?? 0),
      )
      const focusTicker = posHoldings[0] ?? allSorted[0]
      const isBullish = debateResolution.consensusDirection === 'positive' || debateResolution.consensusDirection === 'mixed'

      if (focusTicker) {
        const smallSize = Math.round(focusTicker.holdingValueCad * 0.05) || 500
        const largerSize = Math.round(focusTicker.holdingValueCad * 0.15) || 1500
        const existsInPortfolio = focusTicker.holdingValueCad > 0

        const conservativeAction = existsInPortfolio
          ? { ticker: focusTicker.ticker, name: focusTicker.name, action: 'increase' as const, currentValueCad: focusTicker.holdingValueCad, suggestedChangePct: 5, suggestedChangeCad: smallSize, rationale: `Small increase based on ${isBullish ? 'positive' : 'mixed'} analysis — limits downside while capturing upside` }
          : { ticker: focusTicker.ticker, name: focusTicker.name, action: 'add_new' as const, currentValueCad: 0, suggestedChangeCad: smallSize, rationale: `Starter position based on ${isBullish ? 'positive' : 'mixed'} analysis — small size to manage risk` }

        const convictionAction = existsInPortfolio
          ? { ticker: focusTicker.ticker, name: focusTicker.name, action: 'increase' as const, currentValueCad: focusTicker.holdingValueCad, suggestedChangePct: 15, suggestedChangeCad: largerSize, rationale: `Larger position increase — analysis supports ${isBullish ? 'upside' : 'the thesis'} with calibrated impact of $${Math.abs(focusTicker.impact['1M']?.mid ?? 0).toLocaleString()}` }
          : { ticker: focusTicker.ticker, name: focusTicker.name, action: 'add_new' as const, currentValueCad: 0, suggestedChangeCad: largerSize, rationale: `Meaningful position — analysis supports ${isBullish ? 'upside potential' : 'the thesis'}` }

        return [
          {
            id: 'do-nothing',
            title: 'Do nothing',
            description: `Keep your current portfolio unchanged. ${existsInPortfolio ? `Your ${focusTicker.ticker} position stays at $${focusTicker.holdingValueCad.toLocaleString()}.` : `You stay without exposure to ${focusTicker.ticker}.`}`,
            estimatedCost: '$0',
            riskReduction: 'None — no change to portfolio',
            tradeoffs: ['No cost or risk', `Miss potential ${isBullish ? 'upside' : 'opportunity'} if analysis is correct`],
            isDoNothing: true,
          },
          {
            id: 'conservative',
            title: 'Conservative approach',
            description: `${existsInPortfolio ? 'Modestly increase' : 'Start a small position in'} ${focusTicker.ticker} (~$${smallSize.toLocaleString()}).`,
            estimatedCost: `~$${smallSize.toLocaleString()}`,
            riskReduction: `Limited downside — small position size`,
            tradeoffs: ['Lower commitment', 'Less upside if thesis plays out', 'Easy to add more later'],
            isDoNothing: false,
            actions: [conservativeAction],
          },
          {
            id: 'conviction',
            title: 'Conviction approach',
            description: `${existsInPortfolio ? 'Significantly increase' : 'Take a meaningful position in'} ${focusTicker.ticker} (~$${largerSize.toLocaleString()}).`,
            estimatedCost: `~$${largerSize.toLocaleString()}`,
            riskReduction: `Higher exposure — ${isBullish ? 'aligned with bullish analysis' : 'thesis-driven'}`,
            tradeoffs: ['Higher upfront commitment', `Larger downside if analysis is wrong`, `Better upside capture if ${focusTicker.ticker} moves as predicted`],
            isDoNothing: false,
            actions: [convictionAction],
          },
        ]
      }
    }

    // Market event fallback: hedging/protection options
    const hedgeBudget = Math.round(Math.abs(totalMid) * 0.3)
    const bondAlloc = Math.round(hedgeBudget * 0.5)
    const goldAlloc = Math.round(hedgeBudget * 0.3)
    const cashAlloc = hedgeBudget - bondAlloc - goldAlloc

    const lightActions = [
      ...negHoldings.slice(0, 2).map((h) => ({
        ticker: h.ticker,
        name: h.name,
        action: 'reduce' as const,
        currentValueCad: h.holdingValueCad,
        suggestedChangePct: -15,
        suggestedChangeCad: -Math.round(h.holdingValueCad * 0.15),
        rationale: `Trim position to reduce ~$${Math.abs(h.impact['1M']?.mid ?? 0).toLocaleString()} downside exposure`,
      })),
      {
        ticker: 'CGL.C',
        name: 'iShares Gold Bullion ETF (CAD-Hedged)',
        action: 'add_new' as const,
        currentValueCad: 0,
        suggestedChangeCad: goldAlloc,
        rationale: 'Gold as a defensive store of value — historically uncorrelated with equities',
      },
    ]
    const lightCost = lightActions.reduce((s, a) => s + Math.abs(a.suggestedChangeCad), 0)

    const balancedReduces = negHoldings.slice(0, Math.min(3, negHoldings.length)).map((h) => ({
      ticker: h.ticker,
      name: h.name,
      action: 'reduce' as const,
      currentValueCad: h.holdingValueCad,
      suggestedChangePct: -25,
      suggestedChangeCad: -Math.round(h.holdingValueCad * 0.25),
      rationale: `Reduce exposure to offset ~$${Math.abs(h.impact['1M']?.mid ?? 0).toLocaleString()} projected impact`,
    }))
    const balancedIncreases = posHoldings.slice(0, 1).map((h) => ({
      ticker: h.ticker,
      name: h.name,
      action: 'increase' as const,
      currentValueCad: h.holdingValueCad,
      suggestedChangePct: 10,
      suggestedChangeCad: Math.round(h.holdingValueCad * 0.1),
      rationale: `Positively impacted by signal — lean into the tailwind (+$${(h.impact['1M']?.mid ?? 0).toLocaleString()})`,
    }))
    const balancedHedges = [
      {
        ticker: 'XBB',
        name: 'iShares Core Canadian Universe Bond Index ETF',
        action: 'add_new' as const,
        currentValueCad: 0,
        suggestedChangeCad: bondAlloc,
        rationale: 'Bonds provide income and reduce portfolio volatility during equity stress',
      },
      {
        ticker: 'CGL.C',
        name: 'iShares Gold Bullion ETF (CAD-Hedged)',
        action: 'add_new' as const,
        currentValueCad: 0,
        suggestedChangeCad: goldAlloc,
        rationale: 'Gold hedge — performs well during market uncertainty and inflation risk',
      },
      ...(cashAlloc > 100 ? [{
        ticker: 'CASH.TO',
        name: 'Global X High Interest Savings ETF',
        action: 'add_new' as const,
        currentValueCad: 0,
        suggestedChangeCad: cashAlloc,
        rationale: 'Park funds in a high-interest savings ETF while waiting for clarity',
      }] : []),
    ]
    const balancedActions = [...balancedReduces, ...balancedIncreases, ...balancedHedges]
    const balancedCost = balancedActions.reduce((s, a) => s + Math.abs(a.suggestedChangeCad), 0)

    const hedgeNames = balancedHedges.map((h) => h.ticker).join(', ')

    return [
      {
        id: 'do-nothing',
        title: 'Do nothing',
        description: `Accept the estimated ${totalMid < 0 ? 'loss' : 'impact'} of ~$${Math.round(Math.abs(totalMid)).toLocaleString()}.`,
        estimatedCost: '$0',
        riskReduction: `None — accept ~$${Math.round(Math.abs(totalMid)).toLocaleString()} risk`,
        tradeoffs: ['No cost', 'Full exposure to the risk'],
        isDoNothing: true,
      },
      {
        id: 'light',
        title: 'Light protection',
        description: `Trim the most exposed holdings and add a small gold position as a hedge.`,
        estimatedCost: `~$${lightCost.toLocaleString()}`,
        riskReduction: `Reduces risk by ~$${Math.round(Math.abs(totalMid) * 0.4).toLocaleString()}`,
        tradeoffs: ['Lower cost', 'Partial protection — still exposed to remaining positions', 'Gold adds diversification but may not fully offset equity risk'],
        isDoNothing: false,
        actions: lightActions,
      },
      {
        id: 'balanced',
        title: 'Balanced response',
        description: `Reduce the most affected positions, ${posHoldings.length > 0 ? `lean into ${posHoldings[0].ticker}'s tailwind, ` : ''}and diversify into ${hedgeNames}.`,
        estimatedCost: `~$${balancedCost.toLocaleString()}`,
        riskReduction: `Reduces risk by ~$${Math.round(Math.abs(totalMid) * 0.7).toLocaleString()}`,
        tradeoffs: ['Higher upfront cost', 'Better downside protection across bonds, gold, and cash', 'May miss upside if signal reverses'],
        isDoNothing: false,
        actions: balancedActions,
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
  readonly onThinking?: ThinkingCallback
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
    onThinking,
  } = params

  // Steps 1-3: Calibrate all holding impacts
  onThinking?.('verdict', 'Calibrating dollar impacts across all holdings...')
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

  const totalMid1M = calibratedImpacts.reduce((sum, h) => sum + (h.impact['1M']?.mid ?? 0), 0)
  onThinking?.('verdict', `Calibrated ${calibratedImpacts.length} holdings. Net 1M impact: $${totalMid1M.toLocaleString()}`)

  // Step 4: Generate recommendations
  onThinking?.('verdict', 'Generating recommendation options with do-nothing baseline...')
  const recommendations = await generateRecommendations({
    calibratedImpacts,
    riskProfile,
    debateResolution,
    stressTest,
    userExpectations,
    signal,
  })

  const actionableCount = recommendations.filter((r) => !r.isDoNothing).length
  onThinking?.('verdict', `Generated ${recommendations.length} options (${actionableCount} actionable + do-nothing baseline)`)

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
