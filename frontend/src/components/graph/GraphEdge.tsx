import { memo } from 'react'
import type { CausalChainEdge } from '@prism/shared'
import { getEdgeColor, getEdgeOpacity, getEdgeThickness } from './graph-utils'

interface GraphEdgeProps {
  readonly edge: CausalChainEdge
  readonly source: { x: number; y: number }
  readonly target: { x: number; y: number }
}

function edgePath(source: { x: number; y: number }, target: { x: number; y: number }): string {
  const controlOffset = Math.max(56, (target.x - source.x) * 0.45)
  return `M ${source.x} ${source.y} C ${source.x + controlOffset} ${source.y}, ${target.x - controlOffset} ${target.y}, ${target.x} ${target.y}`
}

function GraphEdgeComponent({ edge, source, target }: GraphEdgeProps) {
  const stroke = getEdgeColor(edge.direction)

  return (
    <path
      className="graph-edge"
      d={edgePath(source, target)}
      fill="none"
      stroke={stroke}
      strokeWidth={getEdgeThickness(edge.magnitude)}
      strokeOpacity={getEdgeOpacity(edge.confidence)}
      strokeLinecap="round"
      markerEnd="url(#graph-arrowhead)"
      data-edge-id={edge.id}
    />
  )
}

export const GraphEdge = memo(GraphEdgeComponent)
