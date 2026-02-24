import type { CausalChainNode } from '@prism/shared'
import type { GraphTimeHorizon } from '../../types/graph'

interface GraphTooltipProps {
  readonly node: CausalChainNode
  readonly impact: number
  readonly horizon: GraphTimeHorizon
  readonly x: number
  readonly y: number
}

function formatHorizon(horizon: GraphTimeHorizon): string {
  if (horizon === 'oneWeek') return '1 week'
  if (horizon === 'oneMonth') return '1 month'
  return '6 months'
}

export function GraphTooltip({ node, impact, horizon, x, y }: GraphTooltipProps) {
  return (
    <aside className="graph-tooltip" style={{ left: x, top: y }}>
      <p className="graph-tooltip__title">{node.label}</p>
      <p className="graph-tooltip__row">
        <span>Type</span>
        <strong>{node.type}</strong>
      </p>
      <p className="graph-tooltip__row">
        <span>Confidence</span>
        <strong>{Math.round(node.confidence * 100)}%</strong>
      </p>
      <p className="graph-tooltip__row">
        <span>{formatHorizon(horizon)}</span>
        <strong>
          {impact >= 0 ? '+' : '-'}${Math.abs(impact).toFixed(0)}
        </strong>
      </p>
    </aside>
  )
}
