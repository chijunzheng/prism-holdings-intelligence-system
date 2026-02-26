import type { CausalChain, CausalChainEdge, CausalChainNode } from '@prism/shared'
import type { GraphTimeHorizon, TemporalAnalysis } from '../../types/graph'

interface GraphPath {
  readonly nodeIds: ReadonlyArray<string>
  readonly edges: ReadonlyArray<CausalChainEdge>
}

interface TooltipConfidenceDriver {
  readonly label: string
  readonly detail: string
  readonly score: number
}

export interface TooltipHoldingImpact {
  readonly ticker: string
  readonly impactCad: number
  readonly impactPct: number | null
}

export interface TooltipPathImpact {
  readonly label: string
  readonly impactCad: number
  readonly contributionPct: number
  readonly direction: 'positive' | 'negative' | 'ambiguous'
}

export interface GraphTooltipModel {
  readonly title: string
  readonly nodeTypeLabel: string
  readonly horizonLabel: string
  readonly confidencePct: number
  readonly portfolioImpactCad: number
  readonly portfolioImpactPct: number | null
  readonly nodeImpactCad: number
  readonly nodeImpactPct: number | null
  readonly noMeasurableImpact: boolean
  readonly topHoldings: ReadonlyArray<TooltipHoldingImpact>
  readonly pathAttributions: ReadonlyArray<TooltipPathImpact>
  readonly otherPathCount: number
  readonly otherPathContributionPct: number
  readonly confidenceDrivers: ReadonlyArray<TooltipConfidenceDriver>
  readonly interpretation: string
  readonly actionHint: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function horizonLabel(horizon: GraphTimeHorizon): string {
  if (horizon === 'oneWeek') return '1 week'
  if (horizon === 'oneMonth') return '1 month'
  return '6 months'
}

function nodeTypeLabel(type: CausalChainNode['type']): string {
  if (type === 'event') return 'Event'
  if (type === 'mechanism') return 'Mechanism'
  if (type === 'sector') return 'Sector'
  return 'Holding'
}

function directionSign(direction: CausalChainEdge['direction']): number {
  if (direction === 'positive') return 1
  if (direction === 'negative') return -1
  return 0
}

function directionFromImpact(impact: number): 'positive' | 'negative' | 'ambiguous' {
  if (impact > 0.5) return 'positive'
  if (impact < -0.5) return 'negative'
  return 'ambiguous'
}

function formatScoreLabel(score: number): string {
  if (score >= 0.75) return 'High'
  if (score >= 0.45) return 'Medium'
  return 'Low'
}

function shortLabel(value: string, max = 28): string {
  const normalized = value.trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}

function resolveTicker(node: CausalChainNode): string {
  const fromMetadata = typeof node.metadata.ticker === 'string' ? node.metadata.ticker : ''
  if (fromMetadata) return fromMetadata
  const trimmed = node.label.trim()
  if (/^[A-Z]{1,6}(\.[A-Z]{1,3})?$/.test(trimmed)) return trimmed
  return shortLabel(trimmed, 10)
}

function buildNodeIndex(chain: CausalChain): {
  readonly nodeById: ReadonlyMap<string, CausalChainNode>
  readonly outgoing: ReadonlyMap<string, ReadonlyArray<CausalChainEdge>>
  readonly incoming: ReadonlyMap<string, ReadonlyArray<CausalChainEdge>>
} {
  const nodeById = new Map<string, CausalChainNode>()
  const outgoing = new Map<string, CausalChainEdge[]>()
  const incoming = new Map<string, CausalChainEdge[]>()

  for (const node of chain.nodes) nodeById.set(node.id, node)
  for (const edge of chain.edges) {
    const out = outgoing.get(edge.source) ?? []
    out.push(edge)
    outgoing.set(edge.source, out)

    const inEdges = incoming.get(edge.target) ?? []
    inEdges.push(edge)
    incoming.set(edge.target, inEdges)
  }

  return { nodeById, outgoing, incoming }
}

function buildEventToAssetPaths(
  chain: CausalChain,
  outgoing: ReadonlyMap<string, ReadonlyArray<CausalChainEdge>>,
  nodeById: ReadonlyMap<string, CausalChainNode>,
): ReadonlyArray<GraphPath> {
  const paths: GraphPath[] = []
  const eventIds = chain.nodes.filter((node) => node.type === 'event').map((node) => node.id)

  function dfs(
    nodeId: string,
    pathNodeIds: string[],
    pathEdges: CausalChainEdge[],
    depth: number,
  ): void {
    if (depth > 4) return
    const node = nodeById.get(nodeId)
    if (!node) return

    if (node.type === 'asset' && pathEdges.length > 0) {
      paths.push({ nodeIds: [...pathNodeIds], edges: [...pathEdges] })
      return
    }

    const nextEdges = outgoing.get(nodeId) ?? []
    for (const edge of nextEdges) {
      if (pathNodeIds.includes(edge.target)) continue
      dfs(edge.target, [...pathNodeIds, edge.target], [...pathEdges, edge], depth + 1)
    }
  }

  for (const eventId of eventIds) {
    dfs(eventId, [eventId], [], 0)
  }

  return paths
}

function findDescendantAssetIds(
  node: CausalChainNode,
  paths: ReadonlyArray<GraphPath>,
): ReadonlySet<string> {
  if (node.type === 'asset') return new Set([node.id])
  const ids = new Set<string>()
  for (const path of paths) {
    if (!path.nodeIds.includes(node.id)) continue
    const assetId = path.nodeIds[path.nodeIds.length - 1]
    ids.add(assetId)
  }
  return ids
}

function parseDetectedHours(value: string): number | null {
  const match = value.match(/(\d{1,4})\s*h(?:ours?)?\s*ago/i)
  if (!match) return null
  const parsed = Number.parseInt(match[1] ?? '', 10)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function computeFreshnessDriver(
  node: CausalChainNode,
  nodeById: ReadonlyMap<string, CausalChainNode>,
  outgoing: ReadonlyMap<string, ReadonlyArray<CausalChainEdge>>,
  incoming: ReadonlyMap<string, ReadonlyArray<CausalChainEdge>>,
): TooltipConfidenceDriver {
  const descriptions: string[] = [node.description]
  const relatedIds = new Set<string>()

  for (const edge of incoming.get(node.id) ?? []) relatedIds.add(edge.source)
  for (const edge of outgoing.get(node.id) ?? []) relatedIds.add(edge.target)
  for (const id of relatedIds) {
    const related = nodeById.get(id)
    if (!related) continue
    if (related.type === 'mechanism') descriptions.push(related.description)
  }

  const hours = descriptions
    .map(parseDetectedHours)
    .filter((value): value is number => value !== null)

  if (hours.length === 0) {
    return {
      label: 'Freshness',
      detail: 'Timestamp signal unavailable',
      score: 0.5,
    }
  }

  const freshest = Math.min(...hours)
  if (freshest <= 6) {
    return { label: 'Freshness', detail: `Updated ${freshest}h ago`, score: 0.95 }
  }
  if (freshest <= 24) {
    return { label: 'Freshness', detail: `Updated ${freshest}h ago`, score: 0.78 }
  }
  if (freshest <= 72) {
    return { label: 'Freshness', detail: `Updated ${freshest}h ago`, score: 0.58 }
  }
  return { label: 'Freshness', detail: `Updated ${freshest}h ago`, score: 0.36 }
}

function computeEvidenceDriver(
  node: CausalChainNode,
  paths: ReadonlyArray<GraphPath>,
  incoming: ReadonlyMap<string, ReadonlyArray<CausalChainEdge>>,
  outgoing: ReadonlyMap<string, ReadonlyArray<CausalChainEdge>>,
): TooltipConfidenceDriver {
  const pathCount = paths.filter((path) => path.nodeIds.includes(node.id)).length
  const incidentCount = (incoming.get(node.id)?.length ?? 0) + (outgoing.get(node.id)?.length ?? 0)
  const evidenceCount = Math.max(pathCount, incidentCount, 1)
  const score = clamp(Math.log2(evidenceCount + 1) / 3, 0.28, 0.96)

  return {
    label: 'Evidence',
    detail: `${evidenceCount} independent transmission links`,
    score,
  }
}

function computeAgreementDriver(
  node: CausalChainNode,
  incoming: ReadonlyMap<string, ReadonlyArray<CausalChainEdge>>,
  outgoing: ReadonlyMap<string, ReadonlyArray<CausalChainEdge>>,
): TooltipConfidenceDriver {
  const relevantEdges: ReadonlyArray<CausalChainEdge> = node.type === 'event'
    ? (outgoing.get(node.id) ?? [])
    : node.type === 'asset'
      ? (incoming.get(node.id) ?? [])
      : [...(incoming.get(node.id) ?? []), ...(outgoing.get(node.id) ?? [])]

  if (relevantEdges.length === 0) {
    return {
      label: 'Agreement',
      detail: 'No directional evidence',
      score: 0.5,
    }
  }

  const signed = relevantEdges.map((edge) => directionSign(edge.direction))
  const score = clamp(
    Math.abs(signed.reduce((sum, value) => sum + value, 0)) / relevantEdges.length,
    0.18,
    0.98,
  )

  return {
    label: 'Agreement',
    detail: score >= 0.7 ? 'Signals aligned' : score >= 0.45 ? 'Mixed but leaning' : 'Conflicting',
    score,
  }
}

function buildPathAttributions(
  node: CausalChainNode,
  paths: ReadonlyArray<GraphPath>,
  nodeById: ReadonlyMap<string, CausalChainNode>,
  impactByNodeId: ReadonlyMap<string, number>,
): {
  readonly topPaths: ReadonlyArray<TooltipPathImpact>
  readonly otherPathCount: number
  readonly otherPathContributionPct: number
} {
  const rows = paths
    .filter((path) => path.nodeIds.includes(node.id))
    .map((path) => {
      const assetId = path.nodeIds[path.nodeIds.length - 1]
      const assetImpact = impactByNodeId.get(assetId) ?? 0
      const startIdx = Math.max(0, path.nodeIds.indexOf(node.id))
      const labels = path.nodeIds
        .slice(startIdx)
        .map((id) => shortLabel(nodeById.get(id)?.label ?? id, 24))
      const label = labels.join(' -> ')

      const edgeWeight = path.edges.reduce(
        (product, edge) => product * Math.max(0.08, edge.magnitude * edge.confidence),
        1,
      )
      const directional = path.edges.reduce((product, edge) => {
        const sign = directionSign(edge.direction)
        return sign === 0 ? product : product * sign
      }, 1)
      const directionScale = path.edges.some((edge) => edge.direction === 'ambiguous') ? 0.45 : 1
      const signedImpact = assetImpact * edgeWeight * directional * directionScale

      return {
        label,
        impactCad: signedImpact,
        absImpact: Math.abs(signedImpact),
      }
    })
    .filter((row) => row.absImpact >= 0.25)
    .sort((a, b) => b.absImpact - a.absImpact)

  if (rows.length === 0) {
    return { topPaths: [], otherPathCount: 0, otherPathContributionPct: 0 }
  }

  const totalAbs = rows.reduce((sum, row) => sum + row.absImpact, 0)
  const top = rows.slice(0, 2).map((row) => ({
    label: row.label,
    impactCad: row.impactCad,
    contributionPct: (row.absImpact / totalAbs) * 100,
    direction: directionFromImpact(row.impactCad),
  }))

  const otherRows = rows.slice(2)
  const otherAbs = otherRows.reduce((sum, row) => sum + row.absImpact, 0)

  return {
    topPaths: top,
    otherPathCount: otherRows.length,
    otherPathContributionPct: totalAbs > 0 ? (otherAbs / totalAbs) * 100 : 0,
  }
}

export function buildGraphTooltipModel(params: {
  readonly node: CausalChainNode
  readonly horizon: GraphTimeHorizon
  readonly impact: number
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
  readonly impactByNodeId: ReadonlyMap<string, number>
}): GraphTooltipModel {
  const { node, horizon, impact, chain, temporalAnalysis, impactByNodeId } = params
  const { nodeById, outgoing, incoming } = buildNodeIndex(chain)
  const paths = buildEventToAssetPaths(chain, outgoing, nodeById)
  const assetIds = findDescendantAssetIds(node, paths)

  const topHoldings = Array.from(assetIds)
    .map((assetId) => nodeById.get(assetId))
    .filter((asset): asset is CausalChainNode => Boolean(asset))
    .map((asset) => {
      const impactCad = impactByNodeId.get(asset.id) ?? 0
      const portfolioValue = temporalAnalysis.totalPortfolioValueCad ?? null
      return {
        ticker: resolveTicker(asset),
        impactCad,
        impactPct: portfolioValue ? impactCad / portfolioValue : null,
      }
    })
    .filter((row) => Math.abs(row.impactCad) >= 1)
    .sort((a, b) => Math.abs(b.impactCad) - Math.abs(a.impactCad))
    .slice(0, 3)

  const uniqueAssetImpactCad = Array.from(assetIds)
    .map((assetId) => impactByNodeId.get(assetId) ?? 0)
    .reduce((sum, value) => sum + value, 0)

  const nodeImpactCad = node.type === 'asset' ? impact : uniqueAssetImpactCad
  const portfolioImpactCad = temporalAnalysis.timeBuckets[horizon].expectedDollarImpact
  const portfolioValue = temporalAnalysis.totalPortfolioValueCad ?? null

  const pathAttribution = buildPathAttributions(node, paths, nodeById, impactByNodeId)
  const freshness = computeFreshnessDriver(node, nodeById, outgoing, incoming)
  const evidence = computeEvidenceDriver(node, paths, incoming, outgoing)
  const agreement = computeAgreementDriver(node, incoming, outgoing)
  const confidenceDrivers = [freshness, evidence, agreement]
  const confidenceBlend = clamp(
    (node.confidence + confidenceDrivers.reduce((sum, driver) => sum + driver.score, 0) / confidenceDrivers.length) / 2,
    0.2,
    0.98,
  )

  const noMeasurableImpact = Math.abs(nodeImpactCad) < 1
  const nodeImpactPct = portfolioValue ? nodeImpactCad / portfolioValue : null
  const portfolioImpactPct = portfolioValue ? portfolioImpactCad / portfolioValue : null

  const direction = directionFromImpact(nodeImpactCad)
  const intensity = nodeImpactPct === null
    ? Math.abs(nodeImpactCad) >= 150 ? 'material' : 'mild'
    : Math.abs(nodeImpactPct) >= 0.01 ? 'material' : 'mild'
  const directionLabel = direction === 'positive' ? 'upside' : direction === 'negative' ? 'downside' : 'mixed impact'

  const interpretation = noMeasurableImpact
    ? `No measurable impact above threshold over ${horizonLabel(horizon)}.`
    : `Modeled ${intensity} ${directionLabel} from ${shortLabel(node.label, 34)} over ${horizonLabel(horizon)}.`

  const actionHint = direction === 'positive'
    ? 'Action hint: stage entries only on confirmation and cap single-name concentration.'
    : direction === 'negative'
      ? 'Action hint: review concentration risk and set explicit rebalance triggers.'
      : 'Action hint: keep this channel on watch and wait for direction confirmation.'

  return {
    title: node.label,
    nodeTypeLabel: nodeTypeLabel(node.type),
    horizonLabel: horizonLabel(horizon),
    confidencePct: Math.round(confidenceBlend * 100),
    portfolioImpactCad,
    portfolioImpactPct,
    nodeImpactCad,
    nodeImpactPct,
    noMeasurableImpact,
    topHoldings,
    pathAttributions: pathAttribution.topPaths,
    otherPathCount: pathAttribution.otherPathCount,
    otherPathContributionPct: pathAttribution.otherPathContributionPct,
    confidenceDrivers: confidenceDrivers.map((driver) => ({
      ...driver,
      score: clamp(driver.score, 0, 1),
      detail: `${formatScoreLabel(driver.score)} · ${driver.detail}`,
    })),
    interpretation,
    actionHint,
  }
}
