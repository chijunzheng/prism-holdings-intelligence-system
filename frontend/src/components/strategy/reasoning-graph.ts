import { DISCLAIMER, type CausalChain, type CausalChainEdge, type CausalChainNode, type Signal } from '@prism/shared'
import type { StrategyScenarioItem, TemporalAnalysis } from '../../types/graph'

interface ReasoningGraphInput {
  readonly signal: Signal | null
  readonly sourceChain: CausalChain | null
  readonly scenarioItems: ReadonlyArray<StrategyScenarioItem>
  readonly temporalAnalysis: TemporalAnalysis | null
}

interface ImpactChannel {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly confidence: number
  readonly dollarImpact: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function shorten(value: string, maxLength = 64): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1)}…`
}

function tokenize(value: string): ReadonlyArray<string> {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
}

function overlapScore(a: string, b: string): number {
  const left = new Set(tokenize(a))
  const right = new Set(tokenize(b))
  if (left.size === 0 || right.size === 0) return 0

  let overlap = 0
  for (const token of left) {
    if (right.has(token)) overlap += 1
  }
  return overlap / Math.max(Math.min(left.size, right.size), 1)
}

function fallbackOneMonthImpact(temporalAnalysis: TemporalAnalysis | null): number {
  return temporalAnalysis?.timeBuckets.oneMonth.expectedDollarImpact ?? -120
}

function deriveImpactChannels(
  signal: Signal | null,
  sourceChain: CausalChain | null,
  temporalAnalysis: TemporalAnalysis | null,
): ReadonlyArray<ImpactChannel> {
  if (sourceChain) {
    const candidates = sourceChain.nodes
      .filter((node) => node.type !== 'event')
      .map((node) => {
        const downside = Math.abs(Math.min(node.dollarImpact ?? 0, 0))
        const magnitude = Math.abs(node.dollarImpact ?? 0)
        const score = downside * 1.2 + magnitude * 0.35 + node.confidence * 120
        return { node, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(({ node }, index) => ({
        id: `impact-${index + 1}`,
        label: node.label,
        description: node.description,
        confidence: node.confidence,
        dollarImpact:
          typeof node.dollarImpact === 'number'
            ? node.dollarImpact
            : fallbackOneMonthImpact(temporalAnalysis) / (index + 1),
      }))

    if (candidates.length > 0) return candidates
  }

  const exposures = signal?.affectedExposures.slice(0, 4) ?? []
  if (exposures.length > 0) {
    return exposures.map((label, index) => ({
      id: `impact-${index + 1}`,
      label,
      description: 'Exposure channel materially affected by current signal context.',
      confidence: clamp((signal?.relevanceScore ?? 0.62) - index * 0.06, 0.45, 0.92),
      dollarImpact: fallbackOneMonthImpact(temporalAnalysis) / (index + 1),
    }))
  }

  return [
    {
      id: 'impact-1',
      label: 'Portfolio Risk Channel',
      description: 'General downside channel inferred from aggregate portfolio context.',
      confidence: 0.58,
      dollarImpact: fallbackOneMonthImpact(temporalAnalysis),
    },
  ]
}

function thesisLabel(rationale: string): string {
  const firstClause = rationale.split(/[.;]/).find((segment) => segment.trim().length > 0) ?? rationale
  return shorten(firstClause, 52)
}

function candidateImpactMatches(
  item: StrategyScenarioItem,
  impacts: ReadonlyArray<ImpactChannel>,
): ReadonlyArray<{ readonly impact: ImpactChannel; readonly score: number }> {
  const candidateText = `${item.ticker} ${item.name} ${item.rationale}`
  const baseScores = impacts.map((impact) => {
    let score = overlapScore(candidateText, `${impact.label} ${impact.description}`)
    const lowerText = candidateText.toLowerCase()
    const impactText = `${impact.label} ${impact.description}`.toLowerCase()

    if (item.type === 'cash') score += 0.18
    if ((lowerText.includes('bond') || lowerText.includes('fixed-income')) &&
      (impactText.includes('rate') || impactText.includes('financial') || impactText.includes('housing'))) {
      score += 0.18
    }
    if ((lowerText.includes('commodity') || lowerText.includes('gold')) &&
      (impactText.includes('inflation') || impactText.includes('energy') || impactText.includes('oil'))) {
      score += 0.18
    }

    return { impact, score: clamp(score, 0, 1) }
  })

  const sorted = [...baseScores].sort((a, b) => b.score - a.score)
  const meaningful = sorted.filter((entry) => entry.score >= 0.08)
  if (meaningful.length > 0) return meaningful.slice(0, Math.min(2, meaningful.length))
  return sorted.slice(0, Math.min(2, sorted.length))
}

export function buildMitigationReasoningChain({
  signal,
  sourceChain,
  scenarioItems,
  temporalAnalysis,
}: ReasoningGraphInput): CausalChain {
  const impacts = deriveImpactChannels(signal, sourceChain, temporalAnalysis)
  const signalId = signal?.id ?? 'portfolio-context'
  const signalNodeId = 'source-signal'

  const eventNode: CausalChainNode = {
    id: signalNodeId,
    type: 'event',
    label: shorten(signal?.headline ?? 'Portfolio context signal', 74),
    description: signal?.description ?? 'Signal context for mitigation planning.',
    confidence: signal?.relevanceScore ?? temporalAnalysis?.confidence ?? 0.62,
    dollarImpact: temporalAnalysis?.timeBuckets.oneMonth.expectedDollarImpact,
    temporalClassification: signal?.temporalClassification ?? temporalAnalysis?.classification,
    metadata: { role: 'source-signal' },
  }

  const impactNodes: ReadonlyArray<CausalChainNode> = impacts.map((impact) => ({
    id: impact.id,
    type: 'mechanism',
    label: impact.label,
    description: impact.description,
    confidence: impact.confidence,
    dollarImpact: impact.dollarImpact,
    metadata: { role: 'impact-channel' },
  }))

  const thesisNodes: ReadonlyArray<CausalChainNode> = scenarioItems.map((item, index) => ({
    id: `thesis-${item.candidateId}`,
    type: 'sector',
    label: thesisLabel(item.rationale),
    description: `Why ${item.ticker}: ${item.rationale}`,
    confidence: clamp(item.confidence, 0.35, 0.96),
    dollarImpact: item.expectedMitigationCad * item.allocationPct,
    metadata: { role: 'mitigation-thesis', index },
  }))

  const candidateNodes: ReadonlyArray<CausalChainNode> = scenarioItems.map((item, index) => ({
    id: `candidate-${item.candidateId}`,
    type: 'asset',
    label: item.ticker,
    description: `${item.name} · Allocation ${item.allocationPct.toFixed(1)}%`,
    confidence: clamp(item.confidence, 0.35, 0.98),
    dollarImpact: item.expectedMitigationCad * item.allocationPct,
    percentageImpact: item.allocationPct,
    metadata: {
      role: 'mitigation-candidate',
      candidateName: item.name,
      candidateType: item.type,
      rationale: item.rationale,
      index,
    },
  }))

  const signalEdges: CausalChainEdge[] = impactNodes.map((impactNode, index) => ({
    id: `edge-source-${impactNode.id}`,
    source: signalNodeId,
    target: impactNode.id,
    magnitude: clamp(0.64 - index * 0.05, 0.34, 0.82),
    direction: 'negative',
    confidence: clamp((eventNode.confidence + impactNode.confidence) / 2, 0.38, 0.92),
    mechanism: `Signal pressure transmitted through ${impactNode.label}.`,
  }))

  const bridgeEdges: CausalChainEdge[] = []
  const thesisEdges: CausalChainEdge[] = []

  scenarioItems.forEach((item) => {
    const thesisId = `thesis-${item.candidateId}`
    const candidateId = `candidate-${item.candidateId}`
    const matchedImpacts = candidateImpactMatches(item, impacts)

    matchedImpacts.forEach((entry, index) => {
      bridgeEdges.push({
        id: `edge-bridge-${entry.impact.id}-${item.candidateId}-${index + 1}`,
        source: entry.impact.id,
        target: thesisId,
        magnitude: clamp(0.3 + entry.score * 0.6, 0.28, 0.92),
        direction: 'positive',
        confidence: clamp((item.confidence + entry.impact.confidence) / 2 + entry.score * 0.18, 0.36, 0.94),
        mechanism: `Mitigation path via ${item.ticker}: ${shorten(item.rationale, 96)}`,
      })
    })

    thesisEdges.push({
      id: `edge-thesis-${item.candidateId}`,
      source: thesisId,
      target: candidateId,
      magnitude: clamp(0.62 + item.confidence * 0.25, 0.5, 0.95),
      direction: 'positive',
      confidence: clamp(item.confidence, 0.4, 0.97),
      mechanism: `Allocate ${item.allocationPct.toFixed(1)}% to execute mitigation thesis.`,
    })
  })

  return {
    id: `mitigation-reasoning-${signalId}`,
    signalId,
    generatedAt: new Date().toISOString(),
    nodes: [eventNode, ...impactNodes, ...thesisNodes, ...candidateNodes],
    edges: [...signalEdges, ...bridgeEdges, ...thesisEdges],
    summary:
      'Reasoning graph links active signal pressure to impact channels and mitigation candidates in the current scenario.',
    disclaimer: DISCLAIMER,
    maxHops: 3,
    isSpeculative: false,
  }
}
