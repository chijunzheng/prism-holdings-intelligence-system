import { useMemo } from 'react'
import type { CausalChainNode, CausalChain, CausalChainEdge } from '@prism/shared'
import type { GraphTimeHorizon, TemporalAnalysis } from '../../types/graph'
import { getHorizonAdjustedImpact } from '../graph/graph-utils'
import { buildGraphTooltipModel } from '../graph/tooltip-utils'

interface NodeDetailsProps {
  readonly node: CausalChainNode | null
  readonly chain: CausalChain | null
  readonly temporalAnalysis: TemporalAnalysis | null
  readonly horizon: GraphTimeHorizon
}

function formatDollar(value: number): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toFixed(0)} CAD`
}

function describeConfidence(confidence: number): string {
  if (confidence >= 0.8) return 'High'
  if (confidence >= 0.5) return 'Moderate'
  return 'Low'
}

function describeTemporal(classification: string): string {
  if (classification === 'transient') return 'Short-lived effect (days to weeks) — likely to fade'
  if (classification === 'structural') return 'Long-lasting shift (months to years) — may persist'
  return 'Uncertain duration — monitor for confirmation'
}

function describeNodeType(type: CausalChainNode['type']): string {
  if (type === 'event') return 'The triggering market event'
  if (type === 'mechanism') return 'How the effect transmits through markets'
  if (type === 'sector') return 'Sector affected in your portfolio'
  return 'Individual holding'
}

function describeDirection(direction: CausalChainEdge['direction']): string {
  if (direction === 'positive') return 'Positive'
  if (direction === 'negative') return 'Negative'
  return 'Mixed'
}

function getConnectedEdges(
  nodeId: string,
  chain: CausalChain,
): ReadonlyArray<{ edge: CausalChainEdge; otherNode: CausalChainNode; role: 'cause' | 'effect' }> {
  const nodeMap = new Map(chain.nodes.map((n) => [n.id, n]))

  const incoming = chain.edges
    .filter((e) => e.target === nodeId)
    .map((edge) => ({ edge, otherNode: nodeMap.get(edge.source)!, role: 'cause' as const }))
    .filter((e) => e.otherNode)

  const outgoing = chain.edges
    .filter((e) => e.source === nodeId)
    .map((edge) => ({ edge, otherNode: nodeMap.get(edge.target)!, role: 'effect' as const }))
    .filter((e) => e.otherNode)

  return [...incoming, ...outgoing]
}

function getClusteredHoldings(
  node: CausalChainNode,
  chain: CausalChain,
): ReadonlyArray<CausalChainNode> | null {
  if (!node.metadata?.clustered) return null
  const sourceIds = node.metadata.sourceNodeIds as string[] | undefined
  if (!sourceIds || sourceIds.length === 0) return null

  const nodeMap = new Map(chain.nodes.map((n) => [n.id, n]))
  return sourceIds.map((id) => {
    const original = nodeMap.get(id)
    return original ?? {
      id,
      type: 'asset' as const,
      label: id,
      description: '',
      confidence: node.confidence,
      metadata: {},
    }
  })
}

function getLookThroughConstituents(node: CausalChainNode): ReadonlyArray<string> {
  const raw = node.metadata?.lookThroughConstituents
  if (!Array.isArray(raw)) return []
  return raw.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
}

function formatHorizon(horizon: GraphTimeHorizon): string {
  if (horizon === 'oneWeek') return '1 week'
  if (horizon === 'oneMonth') return '1 month'
  return '6 months'
}

export function NodeDetails({ node, chain, temporalAnalysis, horizon }: NodeDetailsProps) {
  const diagnostics = useMemo(() => {
    if (!node || !chain || !temporalAnalysis) return null
    const impactByNodeId = new Map<string, number>()
    for (const chainNode of chain.nodes) {
      impactByNodeId.set(
        chainNode.id,
        getHorizonAdjustedImpact(chainNode, temporalAnalysis, horizon, false),
      )
    }
    return buildGraphTooltipModel({
      node,
      horizon,
      impact: impactByNodeId.get(node.id) ?? 0,
      chain,
      temporalAnalysis,
      impactByNodeId,
    })
  }, [chain, horizon, node, temporalAnalysis])

  if (!node) {
    return (
      <p className="node-details__placeholder">
        Click a node on the causal graph to view its details.
      </p>
    )
  }

  const connections = chain ? getConnectedEdges(node.id, chain) : []
  const clusteredHoldings = chain ? getClusteredHoldings(node, chain) : null
  const lookThroughConstituents = getLookThroughConstituents(node)
  const isAsset = node.type === 'asset'

  return (
    <div className="node-details">
      <div>
        <h3 className="node-details__label">{node.label}</h3>
        <span className="node-details__type">{describeNodeType(node.type)}</span>
      </div>

      {node.description && (
        <p className="node-details__description">{node.description}</p>
      )}

      {/* Key metrics */}
      <dl>
        <div className="node-details__row">
          <dt>Confidence</dt>
          <dd>{describeConfidence(node.confidence)} ({(node.confidence * 100).toFixed(0)}%)</dd>
        </div>

        {node.temporalClassification && (
          <div className="node-details__row">
            <dt>Duration</dt>
            <dd className="node-details__temporal">{describeTemporal(node.temporalClassification)}</dd>
          </div>
        )}

        {node.dollarImpact !== undefined && (
          <div className="node-details__row">
            <dt>Estimated {formatHorizon(horizon)} impact</dt>
            <dd>{formatDollar(node.dollarImpact)}</dd>
          </div>
        )}

        {node.percentageImpact !== undefined && (
          <div className="node-details__row">
            <dt>Portfolio weight change</dt>
            <dd>{node.percentageImpact > 0 ? '+' : ''}{(node.percentageImpact * 100).toFixed(1)}%</dd>
          </div>
        )}
      </dl>

      {/* Causal connections */}
      {connections.length > 0 && (
        <div className="node-details__section">
          <h4 className="node-details__section-title">Causal connections</h4>
          <ul className="node-details__connections">
            {connections.map(({ edge, otherNode, role }) => (
              <li key={edge.id} className="node-details__connection">
                <span className={`node-details__direction node-details__direction--${edge.direction}`}>
                  {describeDirection(edge.direction)}
                </span>
                <span className="node-details__connection-label">
                  {role === 'cause' ? `From: ${otherNode.label}` : `To: ${otherNode.label}`}
                </span>
                <span className="node-details__connection-mechanism">{edge.mechanism}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clustered holdings breakdown */}
      {clusteredHoldings && (
        <div className="node-details__section">
          <h4 className="node-details__section-title">Included holdings</h4>
          <p className="node-details__cluster-note">
            These {clusteredHoldings.length} lower-impact holdings were grouped for readability.
            Combined impact: {formatDollar(node.dollarImpact ?? 0)}.
          </p>
          <ul className="node-details__cluster-list">
            {clusteredHoldings.map((h) => (
              <li key={h.id} className="node-details__cluster-item">{h.label}</li>
            ))}
          </ul>
        </div>
      )}

      {lookThroughConstituents.length > 0 && (
        <div className="node-details__section">
          <h4 className="node-details__section-title">Look-through drivers</h4>
          <p className="node-details__cluster-note">
            This holding node is tradeable. Underlying constituents are shown for context.
          </p>
          <ul className="node-details__cluster-list">
            {lookThroughConstituents.map((item) => (
              <li key={item} className="node-details__cluster-item">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {diagnostics && (
        <div className="node-details__section">
          <h4 className="node-details__section-title">Transmission diagnostics</h4>
          <dl>
            <div className="node-details__row">
              <dt>Portfolio ({diagnostics.horizonLabel})</dt>
              <dd>{formatDollar(diagnostics.portfolioImpactCad)}</dd>
            </div>
            <div className="node-details__row">
              <dt>Node-local ({diagnostics.horizonLabel})</dt>
              <dd>{formatDollar(diagnostics.nodeImpactCad)}</dd>
            </div>
            <div className="node-details__row">
              <dt>Confidence score</dt>
              <dd>{diagnostics.confidencePct}%</dd>
            </div>
          </dl>

          {diagnostics.confidenceDrivers.length > 0 && (
            <ul className="node-details__cluster-list">
              {diagnostics.confidenceDrivers.map((driver) => (
                <li key={driver.label} className="node-details__cluster-item">
                  <strong>{driver.label}:</strong> {driver.detail}
                </li>
              ))}
            </ul>
          )}

          {diagnostics.topHoldings.length > 0 && (
            <>
              <h5 className="node-details__section-title">Top impacted holdings</h5>
              <ul className="node-details__cluster-list">
                {diagnostics.topHoldings.map((holding) => (
                  <li key={holding.ticker} className="node-details__cluster-item">
                    {holding.ticker}: {formatDollar(holding.impactCad)}
                  </li>
                ))}
              </ul>
            </>
          )}

          {diagnostics.pathAttributions.length > 0 && (
            <>
              <h5 className="node-details__section-title">Top paths</h5>
              <ul className="node-details__cluster-list">
                {diagnostics.pathAttributions.map((path) => (
                  <li key={path.label} className="node-details__cluster-item">
                    {path.label} ({path.contributionPct.toFixed(0)}%)
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="node-details__cluster-note">{diagnostics.actionHint}</p>
        </div>
      )}

      {/* Speculative warning for deep chains */}
      {isAsset && chain?.isSpeculative && (
        <p className="node-details__speculative">
          This impact estimate involves 4+ causal hops and should be treated as speculative.
        </p>
      )}
    </div>
  )
}
