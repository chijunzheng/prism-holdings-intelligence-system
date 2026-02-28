// Debate Protocol — orchestrates Bull/Bear debate loop with convergence detection.
// Runs 2-3 rounds, exits early when direction agreement or convergence is reached.
// Produces a DebateResolution from the full debate history.

import type {
  DebateArgument,
  DebateResolution,
  AnalystAssessment,
  HoldingImpactEstimate,
  Signal,
  ExposureMap,
  Direction,
} from '@prism/shared'
import { runBullResearcher } from './bull-researcher.js'
import { runBearResearcher } from './bear-researcher.js'

const MAX_ROUNDS = 3

// ── Convergence Detection ───────────────────────────────────
export function hasConverged(
  bullArguments: readonly DebateArgument[],
  bearArguments: readonly DebateArgument[],
): boolean {
  if (bullArguments.length === 0 || bearArguments.length === 0) return false

  const lastBull = bullArguments[bullArguments.length - 1]
  const lastBear = bearArguments[bearArguments.length - 1]

  // Direction agreement — even if magnitude differs
  if (lastBull.position === lastBear.position) return true

  // Concession coverage — both sides have made concessions
  const bullConcessions = lastBull.concessions.length
  const bearConcessions = lastBear.concessions.length
  if (bullConcessions >= 1 && bearConcessions >= 1) return true

  return false
}

// ── Consensus Computation ───────────────────────────────────
function computeConsensus(
  bullArguments: readonly DebateArgument[],
  bearArguments: readonly DebateArgument[],
  analystAssessments: readonly AnalystAssessment[],
): { direction: Direction; magnitude: number; confidence: number } {
  const lastBull = bullArguments[bullArguments.length - 1]
  const lastBear = bearArguments[bearArguments.length - 1]

  // Direction: if they agree, use that. Otherwise use analyst majority.
  let direction: Direction
  if (lastBull.position === lastBear.position) {
    direction = lastBull.position
  } else {
    // Count analyst votes
    const directionVotes = analystAssessments.map((a) => a.overallDirection)
    const negativeBearish = directionVotes.filter(
      (d) => d === 'negative',
    ).length
    const positiveBullish = directionVotes.filter(
      (d) => d === 'positive',
    ).length

    if (negativeBearish > positiveBullish) direction = 'negative'
    else if (positiveBullish > negativeBearish) direction = 'positive'
    else direction = 'mixed'
  }

  // Magnitude: start from analyst average, reduce by debate factor
  const avgMagnitude =
    analystAssessments.reduce((sum, a) => sum + a.overallConfidence, 0) /
    analystAssessments.length

  // Debate typically reduces magnitude (Bear challenges overstated impact)
  const debateReduction = bearArguments.reduce(
    (sum, b) => sum + b.concessions.length * 0.05,
    0,
  )
  const magnitude = Math.max(0, Math.min(1, avgMagnitude - debateReduction))

  // Confidence: higher when debate converges quickly
  const rounds = bullArguments.length
  const convergenceBonus = rounds <= 2 ? 0.1 : 0
  const concessionPenalty = (lastBull.concessions.length + lastBear.concessions.length) * 0.03
  const confidence = Math.max(0, Math.min(1, avgMagnitude + convergenceBonus - concessionPenalty))

  return { direction, magnitude, confidence }
}

// ── Refined Holding Impacts ─────────────────────────────────
// Applies debate outcome to original analyst estimates.
function refineHoldingImpacts(
  analystAssessments: readonly AnalystAssessment[],
  bullConcessions: readonly string[],
  bearConcessions: readonly string[],
): readonly HoldingImpactEstimate[] {
  // Collect all holding impacts from analysts
  const holdingMap = new Map<string, {
    impacts: HoldingImpactEstimate[]
    totalWeight: number
  }>()

  for (const analyst of analystAssessments) {
    for (const impact of analyst.holdingImpacts) {
      const existing = holdingMap.get(impact.ticker)
      if (existing) {
        existing.impacts.push(impact)
        existing.totalWeight += analyst.overallConfidence
      } else {
        holdingMap.set(impact.ticker, {
          impacts: [impact],
          totalWeight: analyst.overallConfidence,
        })
      }
    }
  }

  // Debate adjustment factor: more Bull concessions = lower magnitude
  const bullConcessionFactor = 1 - Math.min(0.3, bullConcessions.length * 0.1)
  // Bear concessions strengthen the case slightly
  const bearConcessionFactor = 1 + Math.min(0.1, bearConcessions.length * 0.05)
  const debateAdjustment = bullConcessionFactor * bearConcessionFactor

  return Array.from(holdingMap.entries()).map(([ticker, data]) => {
    const weightedDirection =
      data.impacts.reduce((sum, imp, i) => {
        const analystWeight = analystAssessments[Math.min(i, analystAssessments.length - 1)].overallConfidence
        return sum + imp.direction * analystWeight
      }, 0) / data.totalWeight

    const avgMagnitude =
      data.impacts.reduce((sum, imp) => sum + imp.magnitudeScore, 0) / data.impacts.length

    const avgConfidence =
      data.impacts.reduce((sum, imp) => sum + imp.confidence, 0) / data.impacts.length

    const bestReasoning = data.impacts
      .filter((imp) => imp.reasoning)
      .map((imp) => imp.reasoning)
      .join(' ')

    return {
      ticker,
      name: data.impacts[0].name,
      direction: Math.max(-1, Math.min(1, weightedDirection)),
      magnitudeScore: Math.max(0, Math.min(1, avgMagnitude * debateAdjustment)),
      confidence: Math.max(0, Math.min(1, avgConfidence)),
      reasoning: bestReasoning || undefined,
    }
  })
}

// ── Extract All Concessions ─────────────────────────────────
function extractAllConcessions(arguments_: readonly DebateArgument[]): readonly string[] {
  return arguments_.flatMap((arg) => arg.concessions)
}

// ── Find Unresolved Disagreements ───────────────────────────
function findUnresolved(
  bullArguments: readonly DebateArgument[],
  bearArguments: readonly DebateArgument[],
): readonly string[] {
  const lastBull = bullArguments[bullArguments.length - 1]
  const lastBear = bearArguments[bearArguments.length - 1]

  // Points that neither side conceded
  const bullPoints = new Set(lastBull.keyPoints)
  const bearPoints = new Set(lastBear.keyPoints)
  const allConcessions = new Set([
    ...extractAllConcessions(bullArguments),
    ...extractAllConcessions(bearArguments),
  ])

  const unresolved: string[] = []

  for (const point of bullPoints) {
    const conceded = [...allConcessions].some((c) =>
      c.toLowerCase().includes(point.toLowerCase().slice(0, 30)),
    )
    if (!conceded) {
      unresolved.push(`Bull claims: ${point}`)
    }
  }

  for (const point of bearPoints) {
    const conceded = [...allConcessions].some((c) =>
      c.toLowerCase().includes(point.toLowerCase().slice(0, 30)),
    )
    if (!conceded) {
      unresolved.push(`Bear claims: ${point}`)
    }
  }

  // Limit to top 5 most important
  return unresolved.slice(0, 5)
}

// ── Main Debate Loop ────────────────────────────────────────
export async function runDebate(params: {
  readonly analystAssessments: readonly AnalystAssessment[]
  readonly signal: Signal
  readonly exposureMap: ExposureMap
}): Promise<DebateResolution> {
  const { analystAssessments, signal, exposureMap } = params
  const bullArguments: DebateArgument[] = []
  const bearArguments: DebateArgument[] = []

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // Bull goes first
    const bullArg = await runBullResearcher({
      round,
      analystAssessments,
      signal,
      exposureMap,
      bearArgument: bearArguments[bearArguments.length - 1],
      ownPriorArgument: bullArguments[bullArguments.length - 1],
    })
    bullArguments.push(bullArg)

    // Bear responds
    const bearArg = await runBearResearcher({
      round,
      analystAssessments,
      signal,
      bullArgument: bullArg,
      ownPriorArgument: bearArguments[bearArguments.length - 1],
    })
    bearArguments.push(bearArg)

    // Check for convergence
    if (hasConverged(bullArguments, bearArguments)) {
      break
    }
  }

  const bullConcessions = extractAllConcessions(bullArguments)
  const bearConcessions = extractAllConcessions(bearArguments)
  const consensus = computeConsensus(bullArguments, bearArguments, analystAssessments)
  const refinedImpacts = refineHoldingImpacts(analystAssessments, bullConcessions, bearConcessions)
  const unresolved = findUnresolved(bullArguments, bearArguments)

  // Interleave transcript chronologically
  const transcript: DebateArgument[] = []
  for (let i = 0; i < bullArguments.length; i++) {
    transcript.push(bullArguments[i])
    if (bearArguments[i]) {
      transcript.push(bearArguments[i])
    }
  }

  return {
    signalId: signal.id,
    rounds: bullArguments.length,
    consensusDirection: consensus.direction,
    consensusMagnitude: consensus.magnitude,
    consensusConfidence: consensus.confidence,
    bullConcessions: [...bullConcessions],
    bearConcessions: [...bearConcessions],
    unresolvedDisagreements: [...unresolved],
    refinedHoldingImpacts: [...refinedImpacts],
    debateTranscript: transcript,
  }
}
