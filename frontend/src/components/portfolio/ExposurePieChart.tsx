import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { ExposureEntry } from '@prism/shared'

interface ExposurePieChartProps {
  readonly exposures: ReadonlyArray<ExposureEntry>
}

const CHART_SIZE = 320
const OUTER_RADIUS = 140
const INNER_RADIUS = 90

/**
 * Muted, professional palette — avoids harsh saturated colors.
 * Ordered so adjacent slices have visual contrast.
 */
const SLICE_COLORS = [
  '#1a1a1a', '#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#84cc16', '#f97316',
  '#06b6d4', '#a855f7', '#10b981', '#e11d48', '#64748b',
]

function getColor(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length]
}

interface SliceData {
  readonly entry: ExposureEntry
  readonly color: string
  readonly startAngle: number
  readonly endAngle: number
}

export function ExposurePieChart({ exposures }: ExposurePieChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const pie = useMemo(
    () =>
      d3
        .pie<ExposureEntry>()
        .value((d) => d.percentage)
        .sort(null)
        .padAngle(0.008),
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

  const slices: ReadonlyArray<SliceData> = useMemo(
    () =>
      arcs.map((a, i) => ({
        entry: a.data,
        color: getColor(i),
        startAngle: a.startAngle,
        endAngle: a.endAngle,
      })),
    [arcs],
  )

  const handleMouseEnter = useCallback((index: number) => {
    setActiveIndex(index)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null)
  }, [])

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

  const activeEntry = activeIndex !== null ? slices[activeIndex] : null

  return (
    <div className="exposure-pie">
      <div className="exposure-pie__chart">
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
            {activeEntry ? `${activeEntry.entry.percentage}%` : 'X-Ray'}
          </text>
          <text
            x={CHART_SIZE / 2}
            y={CHART_SIZE / 2 + 14}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fontSize: '0.75rem', fill: '#6b6b6b' }}
          >
            {activeEntry ? activeEntry.entry.category : 'Hover for details'}
          </text>
        </svg>
      </div>

      <div className="exposure-pie__legend">
        {slices.map((slice, i) => (
          <div
            key={slice.entry.category}
            className={`exposure-pie__legend-item ${i === activeIndex ? 'is-active' : ''}`}
            onMouseEnter={() => handleMouseEnter(i)}
            onMouseLeave={handleMouseLeave}
          >
            <span
              className="exposure-pie__legend-dot"
              style={{ backgroundColor: slice.color }}
            />
            <span className="exposure-pie__legend-label">{slice.entry.category}</span>
            <span className="exposure-pie__legend-value">{slice.entry.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
