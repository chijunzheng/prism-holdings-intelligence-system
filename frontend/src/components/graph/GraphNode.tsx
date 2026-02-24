import type { MouseEvent } from 'react'
import type { CausalChainNode } from '@prism/shared'
import type { GraphNodePosition } from '../../types/graph'

interface GraphNodeProps {
  readonly node: CausalChainNode
  readonly position: GraphNodePosition
  readonly displayImpact: number
  readonly selected: boolean
  readonly onSelect: (node: CausalChainNode) => void
  readonly onHover: (node: CausalChainNode, displayImpact: number, x: number, y: number) => void
  readonly onHoverEnd: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function truncateLabel(label: string, max = 24): string {
  if (label.length <= max) return label
  return `${label.slice(0, max - 1)}…`
}

function nodeFill(node: CausalChainNode, displayImpact: number): string {
  if (node.type === 'event') return '#eff6ff'
  if (node.type === 'mechanism') return '#f1f5f9'
  if (node.type === 'sector') return '#f0fdfa'

  if (displayImpact > 20) return '#f0fdf4'
  if (displayImpact < -20) return '#fef2f2'
  return '#fefce8'
}

function nodeStroke(node: CausalChainNode): string {
  if (node.type === 'event') return '#3b82f6'
  if (node.type === 'mechanism') return '#94a3b8'
  if (node.type === 'sector') return '#14b8a6'
  return '#f59e0b'
}

function assetRadius(displayImpact: number): number {
  const normalized = Math.abs(displayImpact) / 240
  return clamp(24 + normalized, 24, 42)
}

function handleNodeHover(
  event: MouseEvent<SVGGElement>,
  node: CausalChainNode,
  displayImpact: number,
  onHover: (node: CausalChainNode, impact: number, x: number, y: number) => void,
): void {
  onHover(node, displayImpact, event.clientX, event.clientY)
}

export function GraphNode({
  node,
  position,
  displayImpact,
  selected,
  onSelect,
  onHover,
  onHoverEnd,
}: GraphNodeProps) {
  const fill = nodeFill(node, displayImpact)
  const stroke = nodeStroke(node)
  const strokeWidth = selected ? 3 : 1.5
  const isAsset = node.type === 'asset'
  const radius = assetRadius(displayImpact)

  return (
    <g
      className={`graph-node graph-node--${node.type} ${selected ? 'is-selected' : ''}`}
      transform={`translate(${position.x} ${position.y})`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(node)}
      onMouseEnter={(event) => handleNodeHover(event, node, displayImpact, onHover)}
      onMouseMove={(event) => handleNodeHover(event, node, displayImpact, onHover)}
      onMouseLeave={onHoverEnd}
      onBlur={onHoverEnd}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(node)
        }
      }}
    >
      {isAsset ? (
        <circle r={radius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      ) : (
        <rect
          x={-72}
          y={-26}
          width={144}
          height={52}
          rx={node.type === 'mechanism' ? 24 : 12}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}

      <text className="graph-node__label" textAnchor="middle" dominantBaseline="central">
        {truncateLabel(node.label)}
      </text>

      {node.temporalClassification && (
        <text className="graph-node__classification" textAnchor="middle" y={28}>
          {node.temporalClassification.replace('_', ' ')}
        </text>
      )}

      {isAsset && (
        <text className="graph-node__impact" textAnchor="middle" y={44}>
          {displayImpact >= 0 ? '+' : '-'}${Math.abs(displayImpact).toFixed(0)}
        </text>
      )}
    </g>
  )
}
