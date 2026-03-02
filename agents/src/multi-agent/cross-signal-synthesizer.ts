// Cross-Signal Synthesizer — portfolio review mode.
// Aggregates per-signal FundManagerVerdicts into a unified PortfolioVerdict.
// Pure computation for aggregation + interaction classification.
// LLM for interaction insights + holistic recommendations.

import { HumanMessage } from '@langchain/core/messages'
import type {
  FundManagerVerdict,
  Signal,
  HoldingNetImpact,
  DollarRange,
  PortfolioVerdict,
  Recommendation,
  CalibratedHoldingImpact,
} from '@prism/shared'
import { createGeminiChatModel } from '../utils/gemini-chat-model'

// ── Types ───────────────────────────────────────────────────

type SignalVerdict = {
  readonly signal: Signal
  readonly verdict: FundManagerVerdict
}

type SignalContribution = {
  readonly signalId: string
  readonly impact: DollarRange
}

type InteractionType = 'offsetting' | 'compounding' | 'independent'

// ── Pure Computation: Classify Interaction ──────────────────

export function classifyInteraction(
  contributions: readonly SignalContribution[],
): InteractionType {
  if (contributions.length <= 1) return 'independent'

  const directions = contributions.map((c) => Math.sign(c.impact.mid))
  const hasPositive = directions.some((d) => d > 0)
  const hasNegative = directions.some((d) => d < 0)

  if (hasPositive && hasNegative) return 'offsetting'
  return 'compounding'
}

// ── Pure Computation: Gross Impact ──────────────────────────

function computeGrossImpact(contributions: readonly SignalContribution[]): DollarRange {
  return {
    low: contributions.reduce((sum, c) => sum + Math.abs(c.impact.low), 0),
    mid: contributions.reduce((sum, c) => sum + Math.abs(c.impact.mid), 0),
    high: contributions.reduce((sum, c) => sum + Math.abs(c.impact.high), 0),
  }
}

// ── Pure Computation: Net Impact ────────────────────────────

export function computeNetImpact(
  contributions: readonly SignalContribution[],
  interaction: InteractionType,
): DollarRange {
  const lowSum = contributions.reduce((sum, c) => sum + c.impact.low, 0)
  const midSum = contributions.reduce((sum, c) => sum + c.impact.mid, 0)
  const highSum = contributions.reduce((sum, c) => sum + c.impact.high, 0)

  if (interaction === 'offsetting') {
    // Offsetting narrows uncertainty — impacts partially cancel
    return {
      low: Math.min(lowSum, highSum),
      mid: midSum,
      high: Math.max(lowSum, highSum),
    }
  }

  if (interaction === 'compounding') {
    // Compounding widens uncertainty — worst case gets worse
    const spread = Math.abs(highSum - lowSum) * 0.25
    return {
      low: Math.min(lowSum, highSum) - spread,
      mid: midSum,
      high: Math.max(lowSum, highSum) + spread,
    }
  }

  // Independent: simple directional sum
  return { low: lowSum, mid: midSum, high: highSum }
}

// ── Pure Computation: Aggregate Per-Holding ─────────────────

function getImpactAtHorizon(
  impact: CalibratedHoldingImpact['impact'],
): DollarRange {
  // Prefer 1M, fallback to 1W, then 6M
  return impact['1M'] ?? impact['1W'] ?? impact['6M'] ?? { low: 0, mid: 0, high: 0 }
}

export function aggregateHoldingImpacts(
  signalVerdicts: readonly SignalVerdict[],
): readonly HoldingNetImpact[] {
  const holdingMap = new Map<string, {
    holdingName: string
    contributions: SignalContribution[]
  }>()

  for (const { signal, verdict } of signalVerdicts) {
    for (const holding of verdict.holdingImpacts) {
      const existing = holdingMap.get(holding.ticker)
      const contribution: SignalContribution = {
        signalId: signal.id,
        impact: getImpactAtHorizon(holding.impact),
      }

      if (existing) {
        existing.contributions.push(contribution)
      } else {
        holdingMap.set(holding.ticker, {
          holdingName: holding.name,
          contributions: [contribution],
        })
      }
    }
  }

  return [...holdingMap.entries()].map(([ticker, { holdingName, contributions }]) => {
    const interaction = classifyInteraction(contributions)
    const netImpact = computeNetImpact(contributions, interaction)
    const grossImpact = computeGrossImpact(contributions)

    return {
      holdingTicker: ticker,
      holdingName,
      signalContributions: contributions,
      interaction,
      netImpact,
      grossImpact,
    }
  })
}

// ── Pure Computation: Portfolio-Level Aggregation ────────────

export function computePortfolioImpact(
  holdingNetImpacts: readonly HoldingNetImpact[],
): { readonly net: DollarRange; readonly gross: DollarRange } {
  const net: DollarRange = {
    low: holdingNetImpacts.reduce((sum, h) => sum + h.netImpact.low, 0),
    mid: holdingNetImpacts.reduce((sum, h) => sum + h.netImpact.mid, 0),
    high: holdingNetImpacts.reduce((sum, h) => sum + h.netImpact.high, 0),
  }

  const gross: DollarRange = {
    low: holdingNetImpacts.reduce((sum, h) => sum + h.grossImpact.low, 0),
    mid: holdingNetImpacts.reduce((sum, h) => sum + h.grossImpact.mid, 0),
    high: holdingNetImpacts.reduce((sum, h) => sum + h.grossImpact.high, 0),
  }

  return { net, gross }
}

// ── LLM: Interaction Insights ───────────────────────────────

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

function createSynthesizerModel() {
  return createGeminiChatModel({
    model: 'gemini-3-flash-preview',
    temperature: 0.3,
    maxOutputTokens: 4096,
  })
}

export async function generateInteractionInsights(
  holdingNetImpacts: readonly HoldingNetImpact[],
  signalVerdicts: readonly SignalVerdict[],
): Promise<readonly string[]> {
  const interactingHoldings = holdingNetImpacts.filter(
    (h) => h.interaction !== 'independent',
  )

  if (interactingHoldings.length === 0) {
    return ['All signals affect independent holdings — no significant interaction effects detected.']
  }

  const signalSummaries = signalVerdicts
    .map((sv) => `- ${sv.signal.id}: "${sv.signal.headline}"`)
    .join('\n')

  const interactionSummaries = interactingHoldings
    .map((h) => {
      const contribs = h.signalContributions
        .map((c) => `${c.signalId}: $${c.impact.mid.toFixed(0)}`)
        .join(', ')
      return `- ${h.holdingTicker} (${h.holdingName}): ${h.interaction} [${contribs}] → net $${h.netImpact.mid.toFixed(0)} vs gross $${h.grossImpact.mid.toFixed(0)}`
    })
    .join('\n')

  const prompt = `You are a portfolio analyst synthesizing cross-signal interactions.

## Active Signals
${signalSummaries}

## Interaction Effects
${interactionSummaries}

Generate 2-4 plain-English insights about these interactions.
Focus on:
- Which signals offset each other and why
- Which signals compound risk and what the combined exposure means
- Dollar magnitude of the interaction effect (net vs gross difference)

Respond with a JSON array of strings. Each insight should be 1-2 sentences, written for a retail investor.
Example: ["The oil price drop partially offsets the rate hike impact on your energy holdings, reducing net exposure by $120.", "Two signals compound on your bond exposure — combined downside risk is wider than either alone."]`

  const model = createSynthesizerModel()
  const response = await model.invoke([new HumanMessage(prompt)])
  const responseText = typeof response.content === 'string'
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
      : ''

  try {
    const parsed = JSON.parse(extractJson(responseText))
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed
    }
  } catch {
    // Fallback: generate insights from computation
  }

  return interactingHoldings.map((h) => {
    const diff = Math.abs(h.grossImpact.mid - Math.abs(h.netImpact.mid))
    return h.interaction === 'offsetting'
      ? `${h.holdingName} (${h.holdingTicker}): opposing signals offset by ~$${diff.toFixed(0)}, reducing net exposure.`
      : `${h.holdingName} (${h.holdingTicker}): compounding signals increase combined risk by ~$${diff.toFixed(0)}.`
  })
}

// ── LLM: Holistic Recommendations ───────────────────────────

export async function generateHolisticRecommendations(
  signalVerdicts: readonly SignalVerdict[],
  holdingNetImpacts: readonly HoldingNetImpact[],
  portfolioNet: DollarRange,
  portfolioGross: DollarRange,
): Promise<readonly Recommendation[]> {
  const signalSummaries = signalVerdicts
    .map((sv) => {
      const recs = sv.verdict.recommendations
        .map((r) => `  - ${r.title}: ${r.description} (cost: ${r.estimatedCost})`)
        .join('\n')
      return `Signal: "${sv.signal.headline}"\nRecommendations:\n${recs}`
    })
    .join('\n\n')

  const offsettingHoldings = holdingNetImpacts.filter((h) => h.interaction === 'offsetting')
  const compoundingHoldings = holdingNetImpacts.filter((h) => h.interaction === 'compounding')

  const prompt = `You are a portfolio manager creating holistic recommendations that account for ALL active signals simultaneously.

## Portfolio Impact
- Gross impact (signals treated independently): $${portfolioGross.low.toFixed(0)} to $${portfolioGross.high.toFixed(0)} (mid: $${portfolioGross.mid.toFixed(0)})
- Net impact (accounting for interactions): $${portfolioNet.low.toFixed(0)} to $${portfolioNet.high.toFixed(0)} (mid: $${portfolioNet.mid.toFixed(0)})

## Per-Signal Recommendations
${signalSummaries}

## Interaction Effects
${offsettingHoldings.length > 0 ? `Offsetting: ${offsettingHoldings.map((h) => h.holdingTicker).join(', ')}` : 'No offsetting interactions.'}
${compoundingHoldings.length > 0 ? `Compounding: ${compoundingHoldings.map((h) => h.holdingTicker).join(', ')}` : 'No compounding interactions.'}

Generate 2-4 holistic recommendations as a JSON array. Each recommendation must have:
- id: unique string (e.g., "holistic-1")
- title: short action title
- description: 1-2 sentence explanation
- estimatedCost: dollar string (e.g., "$150")
- riskReduction: dollar string describing reduction
- tradeoffs: array of 1-2 trade-off strings
- isDoNothing: boolean (first recommendation MUST be "do nothing" baseline)

CRITICAL: The first recommendation MUST be the "do nothing" baseline showing cumulative cost across all signals.
Flag if hedging one signal increases exposure to another.

Respond with valid JSON only.`

  const model = createSynthesizerModel()
  const response = await model.invoke([new HumanMessage(prompt)])
  const responseText = typeof response.content === 'string'
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
      : ''

  try {
    const parsed = JSON.parse(extractJson(responseText))
    if (Array.isArray(parsed)) {
      return parsed as Recommendation[]
    }
  } catch {
    // Fallback recommendations
  }

  // Fallback: simple do-nothing + reduce-exposure recommendations
  return [
    {
      id: 'holistic-do-nothing',
      title: 'Do nothing',
      description: `Accept cumulative net exposure of ~$${Math.abs(portfolioNet.mid).toFixed(0)} across all active signals.`,
      estimatedCost: '$0',
      riskReduction: 'None',
      tradeoffs: ['No transaction costs', 'Full exposure to all signals'],
      isDoNothing: true,
    },
    {
      id: 'holistic-reduce-compounding',
      title: 'Reduce compounding exposure',
      description: compoundingHoldings.length > 0
        ? `Consider reducing positions in ${compoundingHoldings.map((h) => h.holdingTicker).join(', ')} where multiple signals compound risk.`
        : 'Monitor positions for emerging compounding risks across signals.',
      estimatedCost: 'Varies',
      riskReduction: `~$${Math.abs(portfolioGross.mid - portfolioNet.mid).toFixed(0)} potential reduction`,
      tradeoffs: ['Transaction costs', 'May miss upside if signals reverse'],
      isDoNothing: false,
    },
  ]
}

// ── Main: Synthesize Cross-Signal ───────────────────────────

export async function synthesizeCrossSignal(params: {
  readonly signalVerdicts: readonly SignalVerdict[]
}): Promise<PortfolioVerdict> {
  const { signalVerdicts } = params

  // Step 1: Aggregate per-holding impacts
  const holdingNetImpacts = aggregateHoldingImpacts(signalVerdicts)

  // Step 2: Compute portfolio-level net vs gross
  const { net: portfolioNetImpact, gross: portfolioGrossImpact } =
    computePortfolioImpact(holdingNetImpacts)

  // Step 3: Generate interaction insights (LLM)
  const keyInsights = await generateInteractionInsights(holdingNetImpacts, signalVerdicts)

  // Step 4: Generate holistic recommendations (LLM)
  const recommendations = await generateHolisticRecommendations(
    signalVerdicts,
    holdingNetImpacts,
    portfolioNetImpact,
    portfolioGrossImpact,
  )

  // Step 5: Build interaction summary
  const offsetCount = holdingNetImpacts.filter((h) => h.interaction === 'offsetting').length
  const compoundCount = holdingNetImpacts.filter((h) => h.interaction === 'compounding').length
  const independentCount = holdingNetImpacts.filter((h) => h.interaction === 'independent').length
  const savingsFromOffsets = Math.abs(portfolioGrossImpact.mid) - Math.abs(portfolioNetImpact.mid)

  const interactionSummary = [
    `${signalVerdicts.length} active signals affecting ${holdingNetImpacts.length} holdings.`,
    offsetCount > 0 ? `${offsetCount} holding(s) have offsetting signals, reducing net exposure by ~$${savingsFromOffsets.toFixed(0)}.` : null,
    compoundCount > 0 ? `${compoundCount} holding(s) face compounding risk from multiple signals.` : null,
    independentCount > 0 ? `${independentCount} holding(s) are independently affected.` : null,
    `Gross impact: $${portfolioGrossImpact.mid.toFixed(0)}. Net impact: $${portfolioNetImpact.mid.toFixed(0)}.`,
  ].filter(Boolean).join(' ')

  return {
    signals: signalVerdicts.map((sv) => ({
      signalId: sv.signal.id,
      headline: sv.signal.headline,
      individualVerdict: sv.verdict,
    })),
    holdingNetImpacts: [...holdingNetImpacts],
    portfolioNetImpact,
    portfolioGrossImpact,
    keyInsights: [...keyInsights],
    recommendations: [...recommendations],
    interactionSummary,
    humanDecisionRequired: true as const,
  }
}
