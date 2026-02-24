import { useEffect, useMemo, useRef, useState } from 'react'
import type { CausalChain, CausalChainNode } from '@prism/shared'
import type { GraphTimeHorizon, TemporalAnalysis } from '../../types/graph'
import { useGraphLayout } from '../../hooks/useGraphLayout'
import { getHorizonAdjustedImpact } from './graph-utils'
import { GraphEdge } from './GraphEdge'
import { GraphNode } from './GraphNode'
import { GraphTooltip } from './GraphTooltip'

interface CausalGraphProps {
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
  readonly horizon: GraphTimeHorizon
  readonly counterfactualEnabled: boolean
  readonly expandedDepth: boolean
  readonly selectedNodeId: string | null
  readonly onNodeSelect: (node: CausalChainNode) => void
}

interface TooltipState {
  readonly node: CausalChainNode
  readonly impact: number
  readonly x: number
  readonly y: number
}

const DEFAULT_SIZE = { width: 1100, height: 560 }

export function CausalGraph({
  chain,
  temporalAnalysis,
  horizon,
  counterfactualEnabled,
  expandedDepth,
  selectedNodeId,
  onNodeSelect,
}: CausalGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      const width = Math.max(760, Math.floor(entry.contentRect.width))
      const height = Math.max(420, Math.floor(entry.contentRect.height))
      setSize((prev) => {
        if (prev.width === width && prev.height === height) return prev
        return { width, height }
      })
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const { laidOutChain, positions } = useGraphLayout(chain, {
    width: size.width,
    height: size.height,
    expandedDepth,
  })

  const impactByNodeId = useMemo(() => {
    const map = new Map<string, number>()
    if (!laidOutChain) return map

    for (const node of laidOutChain.nodes) {
      map.set(
        node.id,
        getHorizonAdjustedImpact(node, temporalAnalysis, horizon, counterfactualEnabled),
      )
    }
    return map
  }, [counterfactualEnabled, horizon, laidOutChain, temporalAnalysis])

  const nodes = laidOutChain?.nodes ?? []
  const edges = laidOutChain?.edges ?? []

  function handleNodeHover(node: CausalChainNode, impact: number, x: number, y: number): void {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    setTooltip({
      node,
      impact,
      x: x - rect.left + 14,
      y: y - rect.top + 14,
    })
  }

  return (
    <div className="causal-graph" ref={containerRef}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`}>
        <defs>
          <marker
            id="graph-arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 8 3 L 0 6 z" fill="#64748b" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const source = positions.get(edge.source)
          const target = positions.get(edge.target)
          if (!source || !target) return null
          return <GraphEdge key={edge.id} edge={edge} source={source} target={target} />
        })}

        {nodes.map((node) => {
          const position = positions.get(node.id)
          if (!position) return null

          return (
            <GraphNode
              key={node.id}
              node={node}
              position={position}
              displayImpact={impactByNodeId.get(node.id) ?? 0}
              selected={node.id === selectedNodeId}
              onSelect={onNodeSelect}
              onHover={handleNodeHover}
              onHoverEnd={() => setTooltip(null)}
            />
          )
        })}
      </svg>

      {tooltip && (
        <GraphTooltip
          node={tooltip.node}
          impact={tooltip.impact}
          horizon={horizon}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  )
}
