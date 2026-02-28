import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CausalChain, CausalChainNode } from '@prism/shared'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { GraphTimeHorizon, TemporalAnalysis } from '../../types/graph'
import { useGraphLayout } from '../../hooks/useGraphLayout'
import { getHorizonAdjustedImpact, getNodeHorizonEmphasis } from './graph-utils'
import { GraphEdge } from './GraphEdge'
import { GraphNode } from './GraphNode'
import { GraphTooltip } from './GraphTooltip'

interface CausalGraphProps {
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
  readonly horizon: GraphTimeHorizon
  readonly counterfactualEnabled: boolean
  readonly expandedDepth: boolean
  readonly clusterAssets?: boolean
  readonly selectedNodeId: string | null
  readonly onNodeSelect: (node: CausalChainNode) => void
  readonly mode?: 'canvas' | 'embedded'
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
const EMBEDDED_SIZE = { width: 800, height: 400 }
const MIN_WIDTH = 760
const MAX_WIDTH = 2200
const MIN_HEIGHT = 420
const MAX_HEIGHT = 840
const EMBEDDED_MIN_HEIGHT = 350
const EMBEDDED_MAX_HEIGHT = 450
const MIN_SCALE = 0.3
const MAX_SCALE = 3.0

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function fitToContent(
  positions: ReadonlyMap<string, { x: number; y: number }>,
  containerWidth: number,
  containerHeight: number,
  mode: 'canvas' | 'embedded',
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

  const padding = mode === 'canvas' ? 24 : 48
  const contentWidth = maxX - minX + padding * 2
  const contentHeight = maxY - minY + padding * 2
  const fitScaleCap = mode === 'canvas' ? 2.15 : 1.35
  const scale = clamp(
    Math.min(containerWidth / contentWidth, containerHeight / contentHeight),
    MIN_SCALE,
    fitScaleCap,
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
  clusterAssets = true,
  selectedNodeId,
  onNodeSelect,
  mode = 'canvas',
}: CausalGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState(mode === 'embedded' ? EMBEDDED_SIZE : DEFAULT_SIZE)
  const [hoverTooltip, setHoverTooltip] = useState<TooltipState | null>(null)
  const [pinnedTooltip, setPinnedTooltip] = useState<TooltipState | null>(null)
  const [panZoom, setPanZoom] = useState<PanZoomState>({ panX: 0, panY: 0, scale: 1 })
  const [maximized, setMaximized] = useState(false)
  const isPanning = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const tooltipRafRef = useRef<number | null>(null)
  const queuedTooltipRef = useRef<TooltipState | null>(null)

  useEffect(() => {
    return () => {
      if (tooltipRafRef.current !== null) {
        window.cancelAnimationFrame(tooltipRafRef.current)
        tooltipRafRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      setMaximized(false)
      setPinnedTooltip(null)
      setHoverTooltip(null)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    if (!maximized) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [maximized])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return

      const minHeight = mode === 'embedded' ? EMBEDDED_MIN_HEIGHT : MIN_HEIGHT
      const maxHeightBase = mode === 'embedded' ? EMBEDDED_MAX_HEIGHT : MAX_HEIGHT
      const maxHeight = maximized
        ? Math.max(maxHeightBase, window.innerHeight - 72)
        : maxHeightBase
      const maxWidth = maximized
        ? Math.max(MAX_WIDTH, window.innerWidth - 32)
        : MAX_WIDTH
      const width = clamp(Math.floor(entry.contentRect.width), MIN_WIDTH, maxWidth)
      const height = clamp(Math.floor(entry.contentRect.height), minHeight, maxHeight)
      setSize((prev) => {
        if (prev.width === width && prev.height === height) return prev
        return { width, height }
      })
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [maximized, mode])

  const { laidOutChain, positions } = useGraphLayout(chain, {
    width: size.width,
    height: size.height,
    expandedDepth,
    clusterAssets,
    mode,
  })

  // Fit to content when positions change
  useEffect(() => {
    if (positions.size > 0) {
      setPanZoom(fitToContent(positions, size.width, size.height, mode))
    }
  }, [mode, positions, size.width, size.height])

  const impactByNodeId = useMemo(() => {
    const map = new Map<string, number>()
    for (const node of chain.nodes) {
      map.set(
        node.id,
        getHorizonAdjustedImpact(node, temporalAnalysis, horizon, counterfactualEnabled),
      )
    }
    return map
  }, [chain.nodes, counterfactualEnabled, horizon, temporalAnalysis])

  const nodeById = useMemo(
    () => new Map(chain.nodes.map((node) => [node.id, node])),
    [chain.nodes],
  )

  const nodes = laidOutChain?.nodes ?? []
  const edges = laidOutChain?.edges ?? []

  const resolveTooltipCoordinates = useCallback((x: number, y: number): { x: number; y: number } | null => {
    const container = containerRef.current
    if (!container) return null
    const rect = container.getBoundingClientRect()
    return {
      x: x - rect.left + 14,
      y: y - rect.top + 14,
    }
  }, [])

  const handleNodeHover = useCallback((node: CausalChainNode, impact: number, x: number, y: number): void => {
    if (pinnedTooltip) return
    const coordinates = resolveTooltipCoordinates(x, y)
    if (!coordinates) return
    queuedTooltipRef.current = {
      node,
      impact,
      x: coordinates.x,
      y: coordinates.y,
    }

    if (tooltipRafRef.current !== null) return
    tooltipRafRef.current = window.requestAnimationFrame(() => {
      tooltipRafRef.current = null
      const next = queuedTooltipRef.current
      if (!next) return

      setHoverTooltip((prev) => {
        if (
          prev &&
          prev.node.id === next.node.id &&
          prev.impact === next.impact &&
          Math.abs(prev.x - next.x) < 2 &&
          Math.abs(prev.y - next.y) < 2
        ) {
          return prev
        }
        return next
      })
    })
  }, [pinnedTooltip, resolveTooltipCoordinates])

  const handleNodeHoverEnd = useCallback(() => {
    if (pinnedTooltip) return
    queuedTooltipRef.current = null
    if (tooltipRafRef.current !== null) {
      window.cancelAnimationFrame(tooltipRafRef.current)
      tooltipRafRef.current = null
    }
    setHoverTooltip(null)
  }, [pinnedTooltip])

  const handleGraphNodeSelect = useCallback((node: CausalChainNode, x: number, y: number) => {
    const coordinates = resolveTooltipCoordinates(x, y)
    if (coordinates) {
      setPinnedTooltip({
        node,
        impact: impactByNodeId.get(node.id) ?? 0,
        x: coordinates.x,
        y: coordinates.y,
      })
      setHoverTooltip(null)
    }
    onNodeSelect(node)
  }, [impactByNodeId, onNodeSelect, resolveTooltipCoordinates])

  const handleWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>) => {
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

  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if ((event.target as Element).closest('.graph-node')) return
    setPinnedTooltip(null)
    isPanning.current = true
    lastPointer.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
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
    setPanZoom(fitToContent(positions, size.width, size.height, mode))
  }, [mode, positions, size.width, size.height])

  useEffect(() => {
    if (!pinnedTooltip) return
    const stillExists = chain.nodes.some((node) => node.id === pinnedTooltip.node.id)
    if (!stillExists) setPinnedTooltip(null)
  }, [chain.nodes, pinnedTooltip])

  const activeTooltip = pinnedTooltip ?? hoverTooltip

  const containerClassName = `causal-graph${mode === 'embedded' ? ' causal-graph--embedded' : ''}${maximized ? ' causal-graph--maximized' : ''}`

  return (
    <div className={containerClassName} ref={containerRef}>
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

            const sourceNode = nodeById.get(edge.source)
            const targetNode = nodeById.get(edge.target)
            const sourceEmphasis = sourceNode ? getNodeHorizonEmphasis(sourceNode, horizon) : 1
            const targetEmphasis = targetNode ? getNodeHorizonEmphasis(targetNode, horizon) : 1
            const edgeEmphasis = (sourceEmphasis + targetEmphasis) / 2

            const adjustedEdge = {
              ...edge,
              magnitude: clamp(edge.magnitude * (0.72 + edgeEmphasis * 0.48), 0.05, 1),
              confidence: clamp(edge.confidence * (0.7 + edgeEmphasis * 0.36), 0.2, 1),
            }

            return <GraphEdge key={edge.id} edge={adjustedEdge} source={source} target={target} />
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
                emphasis={getNodeHorizonEmphasis(node, horizon)}
                selected={node.id === selectedNodeId}
                onSelect={handleGraphNodeSelect}
                onHover={handleNodeHover}
                onHoverEnd={handleNodeHoverEnd}
              />
            )
          })}
        </g>
      </svg>

      <div className={`causal-graph__top-controls${mode === 'embedded' ? ' causal-graph__top-controls--embedded' : ''}`}>
        {(mode === 'canvas' || maximized) && (
          <button className="causal-graph__control" onClick={handleReset} type="button">
            Reset view
          </button>
        )}
        <button
          className="causal-graph__control"
          onClick={() => setMaximized((prev) => !prev)}
          type="button"
          aria-label={maximized ? 'Exit maximized canvas' : 'Maximize canvas'}
        >
          {maximized ? 'Exit' : 'Maximize'}
        </button>
      </div>

      {activeTooltip && (
        <GraphTooltip
          node={activeTooltip.node}
          impact={activeTooltip.impact}
          horizon={horizon}
          chain={chain}
          temporalAnalysis={temporalAnalysis}
          impactByNodeId={impactByNodeId}
          x={activeTooltip.x}
          y={activeTooltip.y}
          pinned={Boolean(pinnedTooltip)}
          onUnpin={() => setPinnedTooltip(null)}
        />
      )}
    </div>
  )
}
