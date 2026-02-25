import { useRef, useLayoutEffect, useState } from 'react'
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

function describeNodeType(type: CausalChainNode['type']): string {
  if (type === 'event') return 'Market event triggering the chain'
  if (type === 'mechanism') return 'How the effect transmits'
  if (type === 'sector') return 'Sector affected in your portfolio'
  return 'Individual holding in your portfolio'
}

function describeImpact(impact: number, horizon: string): string {
  const direction = impact >= 0 ? 'gain' : 'loss'
  const amount = `$${Math.abs(impact).toFixed(0)}`
  return `Estimated ${amount} ${direction} over ${horizon}`
}

function describeConfidence(confidence: number): string {
  if (confidence >= 0.8) return 'High confidence'
  if (confidence >= 0.5) return 'Moderate confidence'
  return 'Low confidence'
}

export function GraphTooltip({ node, impact, horizon, x, y }: GraphTooltipProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [offset, setOffset] = useState({ dx: 0, dy: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const parent = el.offsetParent as HTMLElement | null
    if (!parent) return

    const parentRect = parent.getBoundingClientRect()
    const tipW = el.offsetWidth
    const tipH = el.offsetHeight
    const pad = 8

    let dx = 0
    let dy = 0

    if (x + tipW + pad > parentRect.width) {
      dx = -(tipW + 28)
    }

    if (y + tipH + pad > parentRect.height) {
      dy = -(tipH + 28)
    }

    setOffset({ dx, dy })
  }, [x, y])

  const horizonLabel = formatHorizon(horizon)
  const isAsset = node.type === 'asset'

  return (
    <aside
      ref={ref}
      className="graph-tooltip"
      style={{ left: x + offset.dx, top: y + offset.dy }}
    >
      <p className="graph-tooltip__title">{node.label}</p>
      <p className="graph-tooltip__desc">{describeNodeType(node.type)}</p>

      {node.description && (
        <p className="graph-tooltip__mechanism">{node.description}</p>
      )}

      <div className="graph-tooltip__divider" />

      <p className="graph-tooltip__row">
        <span>{describeConfidence(node.confidence)}</span>
        <strong>{Math.round(node.confidence * 100)}%</strong>
      </p>

      {isAsset && (
        <p className="graph-tooltip__row graph-tooltip__row--impact">
          <span>{describeImpact(impact, horizonLabel)}</span>
          <strong>
            {impact >= 0 ? '+' : '-'}${Math.abs(impact).toFixed(0)}
          </strong>
        </p>
      )}

      <p className="graph-tooltip__hint">Click to view details</p>
    </aside>
  )
}
