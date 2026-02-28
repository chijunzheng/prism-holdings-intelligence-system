import { memo, type MouseEvent } from 'react'
import type { CausalChainNode } from '@prism/shared'
import type { GraphNodePosition } from '../../types/graph'
import { TickerIcon } from '../common/TickerIcon'

interface GraphNodeProps {
  readonly node: CausalChainNode
  readonly position: GraphNodePosition
  readonly displayImpact: number
  readonly emphasis: number
  readonly selected: boolean
  readonly onSelect: (node: CausalChainNode, x: number, y: number) => void
  readonly onHover: (node: CausalChainNode, displayImpact: number, x: number, y: number) => void
  readonly onHoverEnd: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function nodeFill(node: CausalChainNode, displayImpact: number): string {
  if (node.type === 'event') return '#ffffff'
  if (node.type === 'mechanism') return '#fafafa'
  if (node.type === 'sector') return '#f8f8f8'

  if (displayImpact > 20) return '#f0faf4'
  if (displayImpact < -20) return '#fdf2f2'
  return '#f9f9f6'
}

function nodeStroke(selected: boolean): string {
  return selected ? '#1a1a1a' : '#d4d4d4'
}

function assetRadius(displayImpact: number): number {
  const normalized = Math.abs(displayImpact) / 240
  return clamp(26 + normalized, 26, 40)
}

function assetTicker(label: string): string {
  const parenTicker = label.match(/\(([A-Z]{1,6}(?:\.[A-Z]{1,3})?)\)/)
  if (parenTicker) return parenTicker[1]

  const leadingTicker = label.match(/^([A-Z]{1,6}(?:\.[A-Z]{1,3})?)(\b|[^A-Z.])/)
  if (leadingTicker) return leadingTicker[1]

  const firstToken = label.trim().split(/\s+/)[0] ?? ''
  const cleaned = firstToken.replace(/[^A-Za-z.]/g, '').toUpperCase()
  return cleaned
}

function computeRectWidth(label: string): number {
  return clamp(label.length * 5.5 + 28, 120, 280)
}

function splitLabel(label: string): readonly string[] {
  if (label.length <= 40) return [label]
  const mid = Math.floor(label.length / 2)
  let splitIdx = label.lastIndexOf(' ', mid)
  if (splitIdx === -1) splitIdx = label.indexOf(' ', mid)
  if (splitIdx === -1) return [label]
  return [label.slice(0, splitIdx), label.slice(splitIdx + 1)]
}

/**
 * Extracts a short display name for asset nodes that fits inside a circle.
 * "NVIDIA Corp. (NVDA)" → "NVDA", "Vanguard S&P 500 Index ETF (VFV)" → "VFV"
 * Falls back to first 6 chars if no ticker found.
 */
function assetShortLabel(label: string): string {
  const tickerMatch = label.match(/\(([A-Z]{1,5})\)/)
  if (tickerMatch) return tickerMatch[1]
  return label.length > 6 ? label.slice(0, 6) : label
}

function isClusteredAsset(node: CausalChainNode): boolean {
  return node.type === 'asset' && node.metadata.clustered === true
}

function handleNodeHover(
  event: MouseEvent<SVGGElement>,
  node: CausalChainNode,
  displayImpact: number,
  onHover: (node: CausalChainNode, impact: number, x: number, y: number) => void,
): void {
  onHover(node, displayImpact, event.clientX, event.clientY)
}

function GraphNodeComponent({
  node,
  position,
  displayImpact,
  emphasis,
  selected,
  onSelect,
  onHover,
  onHoverEnd,
}: GraphNodeProps) {
  const fill = nodeFill(node, displayImpact)
  const stroke = nodeStroke(selected)
  const strokeWidth = selected ? 1.5 : 0.75
  const isAsset = node.type === 'asset'
  const radius = assetRadius(displayImpact)

  const lines = isAsset ? [node.label] : splitLabel(node.label)
  const isMultiLine = lines.length > 1
  const rectWidth = isAsset ? 0 : computeRectWidth(isMultiLine ? lines.reduce((a, b) => (a.length > b.length ? a : b), '') : node.label)
  const rectHeight = isMultiLine ? 56 : 44

  const shortLabel = isAsset ? assetShortLabel(node.label) : ''
  const iconTicker = isAsset ? assetTicker(node.label) : ''
  const showAssetIcon = isAsset && iconTicker.length > 0 && !isClusteredAsset(node)
  const iconSize = clamp(radius * 0.68, 16, 22)
  const labelDy = showAssetIcon ? 4 : -5
  const impactDy = showAssetIcon ? 16 : 9

  return (
    <g
      className={`graph-node graph-node--${node.type} ${selected ? 'is-selected' : ''}`}
      transform={`translate(${position.x} ${position.y})`}
      style={{ opacity: clamp(emphasis, 0.55, 1) }}
      role="button"
      tabIndex={0}
      onClick={(event) => onSelect(node, event.clientX, event.clientY)}
      onMouseEnter={(event) => handleNodeHover(event, node, displayImpact, onHover)}
      onMouseMove={(event) => handleNodeHover(event, node, displayImpact, onHover)}
      onMouseLeave={onHoverEnd}
      onBlur={onHoverEnd}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          onSelect(node, rect.left + rect.width / 2, rect.top + rect.height / 2)
        }
      }}
    >
      {isAsset ? (
        <circle r={radius} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      ) : (
        <rect
          x={-rectWidth / 2}
          y={-rectHeight / 2}
          width={rectWidth}
          height={rectHeight}
          rx={8}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}

      {isAsset ? (
        <>
          {showAssetIcon && (
            <foreignObject
              x={-iconSize / 2}
              y={-radius + 4}
              width={iconSize}
              height={iconSize}
              className="graph-node__asset-icon-fo"
            >
              <div className="graph-node__asset-icon">
                <TickerIcon ticker={iconTicker} size={iconSize} />
              </div>
            </foreignObject>
          )}
          <text className="graph-node__label graph-node__label--asset" textAnchor="middle" dominantBaseline="central" dy={labelDy}>
            {shortLabel}
          </text>
          <text className="graph-node__impact" textAnchor="middle" dy={impactDy}>
            {displayImpact >= 0 ? '+' : '-'}${Math.abs(displayImpact).toFixed(0)}
          </text>
        </>
      ) : isMultiLine ? (
        <text className="graph-node__label" textAnchor="middle" dominantBaseline="central">
          <tspan x={0} dy={-7}>{lines[0]}</tspan>
          <tspan x={0} dy={14}>{lines[1]}</tspan>
        </text>
      ) : (
        <text className="graph-node__label" textAnchor="middle" dominantBaseline="central">
          {node.label}
        </text>
      )}
    </g>
  )
}

export const GraphNode = memo(GraphNodeComponent)
