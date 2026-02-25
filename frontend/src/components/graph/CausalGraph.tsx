import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

interface PanZoomState {
  readonly panX: number
  readonly panY: number
  readonly scale: number
}

const DEFAULT_SIZE = { width: 1100, height: 560 }
const MIN_WIDTH = 760
const MAX_WIDTH = 2200
const MIN_HEIGHT = 420
const MAX_HEIGHT = 720
const MIN_SCALE = 0.3
const MAX_SCALE = 3.0

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function fitToContent(
  positions: ReadonlyMap<string, { x: number; y: number }>,
  containerWidth: number,
  containerHeight: number,
): PanZoomState {
  if (positions.size === 0) return { panX: 0, panY: 0, scale: 1 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x)
    maxY = Math.max(maxY, pos.y)
  }

  const padding = 80
  const contentWidth = maxX - minX + padding * 2
  const contentHeight = maxY - minY + padding * 2
  const scale = clamp(
    Math.min(containerWidth / contentWidth, containerHeight / contentHeight),
    MIN_SCALE,
    1.0,
  )
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const panX = containerWidth / 2 - centerX * scale
  const panY = containerHeight / 2 - centerY * scale

  return { panX, panY, scale }
}

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
  const [panZoom, setPanZoom] = useState<PanZoomState>({ panX: 0, panY: 0, scale: 1 })
  const isPanning = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      const width = clamp(Math.floor(entry.contentRect.width), MIN_WIDTH, MAX_WIDTH)
      const height = clamp(Math.floor(entry.contentRect.height), MIN_HEIGHT, MAX_HEIGHT)
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

  // Fit to content when positions change
  useEffect(() => {
    if (positions.size > 0) {
      setPanZoom(fitToContent(positions, size.width, size.height))
    }
  }, [positions, size.width, size.height])

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

  const handleWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const svgEl = event.currentTarget
    const rect = svgEl.getBoundingClientRect()
    const cursorX = event.clientX - rect.left
    const cursorY = event.clientY - rect.top

    setPanZoom((prev) => {
      const zoomFactor = event.deltaY < 0 ? 1.08 : 1 / 1.08
      const newScale = clamp(prev.scale * zoomFactor, MIN_SCALE, MAX_SCALE)
      const ratio = newScale / prev.scale
      const newPanX = cursorX - (cursorX - prev.panX) * ratio
      const newPanY = cursorY - (cursorY - prev.panY) * ratio
      return { panX: newPanX, panY: newPanY, scale: newScale }
    })
  }, [])

  const handlePointerDown = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('.graph-node')) return
    isPanning.current = true
    lastPointer.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const handlePointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanning.current) return
    const dx = event.clientX - lastPointer.current.x
    const dy = event.clientY - lastPointer.current.y
    lastPointer.current = { x: event.clientX, y: event.clientY }
    setPanZoom((prev) => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }))
  }, [])

  const handlePointerUp = useCallback(() => {
    isPanning.current = false
  }, [])

  const handleReset = useCallback(() => {
    setPanZoom(fitToContent(positions, size.width, size.height))
  }, [positions, size.width, size.height])

  return (
    <div className="causal-graph" ref={containerRef}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        className={isPanning.current ? 'causal-graph__svg--grabbing' : 'causal-graph__svg'}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
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
            <path d="M 0 0 L 8 3 L 0 6 z" fill="#c0c0c0" />
          </marker>
        </defs>

        <g transform={`translate(${panZoom.panX} ${panZoom.panY}) scale(${panZoom.scale})`}>
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
        </g>
      </svg>

      <button className="causal-graph__reset" onClick={handleReset} type="button">
        Reset view
      </button>

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
