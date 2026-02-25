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

    // Flip left if tooltip overflows right edge
    if (x + tipW + pad > parentRect.width) {
      dx = -(tipW + 28)
    }

    // Push up if tooltip overflows bottom edge
    if (y + tipH + pad > parentRect.height) {
      dy = -(tipH + 28)
    }

    setOffset({ dx, dy })
  }, [x, y])

  return (
    <aside
      ref={ref}
      className="graph-tooltip"
      style={{ left: x + offset.dx, top: y + offset.dy }}
    >
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
