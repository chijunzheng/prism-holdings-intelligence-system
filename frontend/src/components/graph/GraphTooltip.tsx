import { useLayoutEffect, useRef, useState } from 'react'
import type { CausalChain, CausalChainNode } from '@prism/shared'
import type { GraphTimeHorizon, TemporalAnalysis } from '../../types/graph'
import { buildGraphTooltipModel } from './tooltip-utils'

interface GraphTooltipProps {
  readonly node: CausalChainNode
  readonly impact: number
  readonly horizon: GraphTimeHorizon
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
  readonly impactByNodeId: ReadonlyMap<string, number>
  readonly x: number
  readonly y: number
  readonly pinned: boolean
  readonly onUnpin: () => void
}

function formatCad(value: number): string {
  const absolute = Math.abs(value)
  const formatted = absolute >= 1000
    ? `${(absolute / 1000).toFixed(1)}K`
    : absolute.toFixed(0)
  return `${value >= 0 ? '+' : '-'}$${formatted}`
}

function formatPct(value: number | null): string {
  if (value === null) return 'n/a'
  return `${value >= 0 ? '+' : '-'}${Math.abs(value * 100).toFixed(2)}%`
}

export function GraphTooltip({
  node,
  impact,
  horizon,
  chain,
  temporalAnalysis,
  impactByNodeId,
  x,
  y,
  pinned,
  onUnpin,
}: GraphTooltipProps) {
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

    if (x + tipW + pad > parentRect.width) dx = -(tipW + 28)
    if (y + tipH + pad > parentRect.height) dy = -(tipH + 28)

    setOffset({ dx, dy })
  }, [x, y, pinned])

  const model = buildGraphTooltipModel({
    node,
    horizon,
    impact,
    chain,
    temporalAnalysis,
    impactByNodeId,
  })

  return (
    <aside
      ref={ref}
      className={`graph-tooltip ${pinned ? 'graph-tooltip--pinned' : ''}`}
      style={{ left: x + offset.dx, top: y + offset.dy }}
    >
      <header className="graph-tooltip__header">
        <div>
          <p className="graph-tooltip__title">{model.title}</p>
          <p className="graph-tooltip__type">{model.nodeTypeLabel}</p>
        </div>
        {pinned && (
          <button
            type="button"
            className="graph-tooltip__close"
            onClick={onUnpin}
            aria-label="Close pinned tooltip"
          >
            Close
          </button>
        )}
      </header>

      <section className="graph-tooltip__section">
        <p className="graph-tooltip__section-title">Impact ({model.horizonLabel})</p>
        <div className="graph-tooltip__row">
          <span>Portfolio</span>
          <strong>{formatCad(model.portfolioImpactCad)} ({formatPct(model.portfolioImpactPct)})</strong>
        </div>
        <div className="graph-tooltip__row">
          <span>Node-local</span>
          <strong>{formatCad(model.nodeImpactCad)} ({formatPct(model.nodeImpactPct)})</strong>
        </div>
        {model.noMeasurableImpact && (
          <p className="graph-tooltip__empty">No measurable impact above threshold.</p>
        )}
      </section>

      <section className="graph-tooltip__section">
        <p className="graph-tooltip__section-title">Quick read</p>
        <div className="graph-tooltip__row">
          <span>Confidence</span>
          <strong>{model.confidencePct}%</strong>
        </div>
        <p className="graph-tooltip__interpretation">{model.interpretation}</p>
        <p className="graph-tooltip__hint">Click for full breakdown in Details.</p>
      </section>
    </aside>
  )
}
