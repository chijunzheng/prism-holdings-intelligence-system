import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import type { ExposureEntry, Signal } from '@prism/shared'
import { formatExposureCategory } from './exposure-category'
import { computeSectorImpacts, formatImpact, type SectorImpact } from './signal-impact-utils'

interface SectorSignalMapProps {
  readonly exposures: ReadonlyArray<ExposureEntry>
  readonly signals?: ReadonlyArray<Signal>
  readonly totalPortfolioValue?: number
}

const CHART_SIZE = 320
const OUTER_RADIUS = 140
const INNER_RADIUS = 90

const SLICE_COLORS = [
  '#1a1a1a', '#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#84cc16', '#f97316',
  '#06b6d4', '#a855f7', '#10b981', '#e11d48', '#64748b',
]

function getColor(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length]
}

export function SectorSignalMap({
  exposures,
  signals = [],
  totalPortfolioValue = 0,
}: SectorSignalMapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const pie = useMemo(
    () => d3.pie<ExposureEntry>().value((d) => d.percentage).sort(null).padAngle(0.008),
    [],
  )
  const arc = useMemo(
    () => d3.arc<d3.PieArcDatum<ExposureEntry>>().innerRadius(INNER_RADIUS).outerRadius(OUTER_RADIUS),
    [],
  )
  const hoverArc = useMemo(
    () => d3.arc<d3.PieArcDatum<ExposureEntry>>().innerRadius(INNER_RADIUS - 4).outerRadius(OUTER_RADIUS + 8),
    [],
  )
  const arcs = useMemo(() => pie([...exposures]), [pie, exposures])

  const sectorImpacts = useMemo(
    () => computeSectorImpacts(signals, exposures, totalPortfolioValue),
    [signals, exposures, totalPortfolioValue],
  )

  const affectedPct = useMemo(
    () => Math.min(100, sectorImpacts
      .filter((s) => s.direction !== 'neutral')
      .reduce((sum, s) => sum + s.percentage, 0)),
    [sectorImpacts],
  )

  const activeSignalCount = useMemo(
    () => new Set(signals.map((s) => s.id)).size,
    [signals],
  )

  const handleMouseEnter = useCallback((index: number) => setActiveIndex(index), [])
  const handleMouseLeave = useCallback(() => setActiveIndex(null), [])

  const handleSectorClick = useCallback((sector: SectorImpact) => {
    if (sector.direction !== 'neutral') {
      navigate(`/impact?sector=${encodeURIComponent(sector.category)}`)
    }
  }, [navigate])

  // Animate on mount
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const paths = svg.querySelectorAll('.pie-slice')
    paths.forEach((path, i) => {
      const el = path as SVGPathElement
      el.style.opacity = '0'
      el.style.transform = 'scale(0.85)'
      el.style.transformOrigin = 'center'
      el.style.transition = `opacity 0.4s ease ${i * 50}ms, transform 0.4s ease ${i * 50}ms`
      requestAnimationFrame(() => {
        el.style.opacity = '1'
        el.style.transform = 'scale(1)'
      })
    })
  }, [exposures])

  const activeEntry = activeIndex !== null ? sectorImpacts[activeIndex] : null

  return (
    <div className="sector-signal-map">
      <div className="sector-signal-map__chart">
        <svg
          ref={svgRef}
          width={CHART_SIZE}
          height={CHART_SIZE}
          viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
        >
          <g transform={`translate(${CHART_SIZE / 2}, ${CHART_SIZE / 2})`}>
            {arcs.map((a, i) => (
              <path
                key={a.data.category}
                className="pie-slice"
                d={(i === activeIndex ? hoverArc(a) : arc(a)) ?? ''}
                fill={getColor(i)}
                style={{ cursor: 'pointer', transition: 'd 0.2s ease' }}
                onMouseEnter={() => handleMouseEnter(i)}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </g>

          {/* Center label */}
          <text
            x={CHART_SIZE / 2}
            y={CHART_SIZE / 2 - 8}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: '1.125rem', fontWeight: 700, fill: '#1a1a1a' }}
          >
            {activeEntry
              ? `${activeEntry.percentage}%`
              : `${affectedPct.toFixed(0)}%`}
          </text>
          <text
            x={CHART_SIZE / 2}
            y={CHART_SIZE / 2 + 14}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: '0.75rem', fill: '#484848' }}
          >
            {activeEntry
              ? formatExposureCategory(activeEntry.category)
              : `affected · ${activeSignalCount} signal${activeSignalCount !== 1 ? 's' : ''}`}
          </text>
        </svg>
      </div>

      <div className="sector-signal-map__legend">
        {sectorImpacts.map((sector, i) => {
          const isClickable = sector.direction !== 'neutral'
          return (
            <div
              key={sector.category}
              className={[
                'sector-signal-map__row',
                i === activeIndex ? 'is-active' : '',
                isClickable ? 'sector-signal-map__row--clickable' : '',
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => handleMouseEnter(i)}
              onMouseLeave={handleMouseLeave}
              onClick={isClickable ? () => handleSectorClick(sector) : undefined}
              onKeyDown={isClickable ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleSectorClick(sector)
                }
              } : undefined}
              tabIndex={isClickable ? 0 : undefined}
              role={isClickable ? 'link' : undefined}
            >
              <span
                className="sector-signal-map__dot"
                style={{ backgroundColor: getColor(i) }}
              />
              <span className="sector-signal-map__label" title={formatExposureCategory(sector.category)}>
                {formatExposureCategory(sector.category)}
              </span>
              <span className="sector-signal-map__pct">{sector.percentage}%</span>

              <div className="sector-signal-map__impact-cell">
                {sector.direction !== 'neutral' ? (
                  <span className={`sector-signal-map__pill sector-signal-map__pill--${sector.direction}`}>
                    <span className="sector-signal-map__pill-dot" />
                    {formatImpact(sector.dollarImpact)}
                  </span>
                ) : (
                  <span className="sector-signal-map__no-signal">—</span>
                )}
              </div>

              {isClickable && (
                <span className="sector-signal-map__arrow">&rarr;</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
