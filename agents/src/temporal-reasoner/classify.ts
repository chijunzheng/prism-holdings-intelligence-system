import {
  TEMPORAL_THRESHOLDS,
  type CausalChain,
  type CausalChainNode,
  type TemporalClassification,
} from '@prism/shared'
import type { ClassificationMethodology, ImpactClassification, TemporalReasoningContext } from './types'

const STRUCTURAL_KEYWORDS = [
  'structural',
  'policy',
  'regulation',
  'tariff',
  'credit',
  'lending',
  'secular',
  'fundamental',
] as const

const TRANSIENT_KEYWORDS = [
  'transient',
  'temporary',
  'short-term',
  'short term',
  'seasonal',
  'sentiment',
  'volatility',
  'one-off',
] as const

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function keywordScore(text: string, keywords: ReadonlyArray<string>): number {
  const lower = text.toLowerCase()
  return keywords.reduce((score, keyword) => (lower.includes(keyword) ? score + 1 : score), 0)
}

function toAssetImpacts(nodes: ReadonlyArray<CausalChainNode>): ReadonlyArray<CausalChainNode> {
  return nodes.filter((node) => node.type === 'asset')
}

function inferImpactClassification(
  node: CausalChainNode,
  overallClassification: TemporalClassification,
  overallConfidence: number,
): ImpactClassification {
  const nodeConfidence = clamp((node.confidence + overallConfidence) / 2, 0, 1)
  const nodeClassification =
    nodeConfidence < TEMPORAL_THRESHOLDS.CONFIDENT_FLOOR
      ? 'ambiguous'
      : node.temporalClassification ?? overallClassification

  return {
    nodeId: node.id,
    assetLabel: node.label,
    ticker: typeof node.metadata.ticker === 'string' ? node.metadata.ticker : undefined,
    dollarImpact: node.dollarImpact ?? 0,
    classification: nodeClassification,
    confidence: round(nodeConfidence),
    reasoning: `${node.label} impact is ${nodeClassification} with ${round(nodeConfidence * 100, 0)}% confidence based on chain confidence and mechanism strength.`,
  }
}

function buildMethodology(
  classification: TemporalClassification,
  structuralScore: number,
  transientScore: number,
  hasCompetingEffects: boolean,
  confidence: number,
): ClassificationMethodology {
  const bias =
    structuralScore === transientScore
      ? 'balanced'
      : structuralScore > transientScore
        ? 'structural-leaning'
        : 'transient-leaning'

  return {
    historicalBaseRate: `Signal pattern scoring is ${bias} (structural=${structuralScore}, transient=${transientScore}).`,
    signalClustering: hasCompetingEffects
      ? 'Competing positive and negative transmission paths indicate clustered effects across horizons.'
      : 'Impact pathways are directionally aligned, indicating cleaner signal propagation.',
    structuralIndicators:
      structuralScore >= transientScore
        ? 'Policy/regulatory and lending mechanism cues support persistence beyond near-term volatility.'
        : 'Short-lived sentiment/volatility cues dominate over fundamental regime-change signals.',
    contextualSynthesis: `Overall classification is ${classification} at ${round(confidence * 100, 0)}% confidence.`,
  }
}

function determineClassification(
  chain: CausalChain,
  confidence: number,
): { classification: TemporalClassification; structuralScore: number; transientScore: number } {
  const mechanismAndSummaryText = [
    chain.summary,
    ...chain.nodes
      .filter((node) => node.type === 'mechanism' || node.type === 'event')
      .map((node) => `${node.label} ${node.description}`),
  ].join(' ')

  const temporalNodes = chain.nodes.filter((node) => node.temporalClassification)
  const structuralNodes = temporalNodes.filter(
    (node) => node.temporalClassification === 'structural',
  ).length
  const transientNodes = temporalNodes.filter(
    (node) => node.temporalClassification === 'transient',
  ).length

  const structuralScore =
    structuralNodes * 2 + keywordScore(mechanismAndSummaryText, STRUCTURAL_KEYWORDS)
  const transientScore =
    transientNodes * 2 + keywordScore(mechanismAndSummaryText, TRANSIENT_KEYWORDS)

  if (confidence < TEMPORAL_THRESHOLDS.CONFIDENT_FLOOR) {
    return { classification: 'ambiguous', structuralScore, transientScore }
  }

  if (Math.abs(structuralScore - transientScore) <= 1) {
    return { classification: 'ambiguous', structuralScore, transientScore }
  }

  return {
    classification: structuralScore > transientScore ? 'structural' : 'transient',
    structuralScore,
    transientScore,
  }
}

export function classifyTemporalDynamics(chain: CausalChain): TemporalReasoningContext {
  const nodeConfidence = average(chain.nodes.map((node) => node.confidence))
  const edgeConfidence = average(chain.edges.map((edge) => edge.confidence))
  const confidence = round((nodeConfidence + edgeConfidence) / 2)

  const positiveEdges = chain.edges.filter((edge) => edge.direction === 'positive').length
  const negativeEdges = chain.edges.filter((edge) => edge.direction === 'negative').length
  const hasCompetingEffects = positiveEdges > 0 && negativeEdges > 0
  const directionBias = positiveEdges - negativeEdges

  const assetNodes = toAssetImpacts(chain.nodes)
  const netDollarImpact = assetNodes.reduce((sum, node) => sum + (node.dollarImpact ?? 0), 0)

  const classificationDecision = determineClassification(chain, confidence)
  const impactClassifications = assetNodes.map((node) =>
    inferImpactClassification(node, classificationDecision.classification, confidence),
  )

  const methodology = buildMethodology(
    classificationDecision.classification,
    classificationDecision.structuralScore,
    classificationDecision.transientScore,
    hasCompetingEffects,
    confidence,
  )

  return {
    classification: classificationDecision.classification,
    confidence,
    methodology,
    impactClassifications,
    netDollarImpact,
    directionBias,
    hasCompetingEffects,
  }
}
