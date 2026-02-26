import type { Signal, ExposureEntry } from '@prism/shared'
import type { KeyboardEvent } from 'react'
import type { Materiality } from './signal-utils'
import { SignalBadge } from './SignalBadge'

interface SignalCardProps {
  readonly signal: Signal
  readonly materiality: Materiality
  readonly viewed: boolean
  readonly onViewAnalysis: (signal: Signal) => void
  readonly exposures?: ReadonlyArray<ExposureEntry>
  readonly totalPortfolioValue?: number
}

function formatDollarImpact(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : '+'
  if (abs >= 1000) {
    return `${prefix}$${(abs / 1000).toFixed(1)}k`
  }
  return `${prefix}$${abs.toFixed(0)}`
}

function estimateImpact(
  signal: Signal,
  exposures: ReadonlyArray<ExposureEntry>,
  totalValue: number,
): { dollarImpact: number; affectedPct: number } | null {
  if (exposures.length === 0 || totalValue === 0) return null

  const affected = exposures.filter((e) =>
    signal.affectedExposures.some(
      (ae) => e.category.toLowerCase().includes(ae.toLowerCase()) ||
              ae.toLowerCase().includes(e.category.toLowerCase()),
    ),
  )
  if (affected.length === 0) return null

  const affectedValue = affected.reduce((sum, e) => sum + e.valueCad, 0)
  const affectedPct = (affectedValue / totalValue) * 100

  const impactMultiplier = signal.urgency === 'critical' ? -0.05
    : signal.urgency === 'high' ? -0.03
    : signal.urgency === 'medium' ? -0.02
    : -0.01
  const dollarImpact = affectedValue * impactMultiplier * signal.relevanceScore

  return { dollarImpact, affectedPct }
}

function handleCardKeyDown(
  event: KeyboardEvent<HTMLElement>,
  signal: Signal,
  onViewAnalysis: (signal: Signal) => void,
) {
  const target = event.target as HTMLElement | null
  if (target?.closest('button, a')) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onViewAnalysis(signal)
  }
}

export function SignalCard({
  signal,
  materiality,
  viewed,
  onViewAnalysis,
  exposures = [],
  totalPortfolioValue = 0,
}: SignalCardProps) {
  const source = signal.sources[0]
  const impact = estimateImpact(signal, exposures, totalPortfolioValue)
  const isAdvisorFlag = materiality === 'high' && signal.urgency !== 'low'

  return (
    <article
      className={`signal-card signal-card--${signal.temporalClassification} signal-card--${materiality} ${viewed ? 'signal-card--viewed' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onViewAnalysis(signal)}
      onKeyDown={(event) => handleCardKeyDown(event, signal, onViewAnalysis)}
    >
      {/* Dollar impact callout */}
      {impact && (
        <div className="signal-card__impact-callout">
          <span className={`signal-card__dollar-impact ${impact.dollarImpact < 0 ? 'signal-card__dollar-impact--negative' : 'signal-card__dollar-impact--positive'}`}>
            {formatDollarImpact(impact.dollarImpact)}
          </span>
          <span className="signal-card__affected-pct">
            {impact.affectedPct.toFixed(0)}% of portfolio
          </span>
        </div>
      )}

      <h3 className="signal-card__headline">{signal.headline}</h3>
      <p className="signal-card__description">{signal.description}</p>

      <div className="signal-card__meta">
        <SignalBadge classification={signal.temporalClassification} />
        <span className="signal-card__meta-separator" />
        <span className={`signal-card__materiality signal-card__materiality--${materiality}`}>
          {materiality.charAt(0).toUpperCase()}{materiality.slice(1)}
        </span>
        {isAdvisorFlag && (
          <>
            <span className="signal-card__meta-separator" />
            <span className="signal-card__advisor-flag">Discuss with advisor</span>
          </>
        )}
        {viewed && <span className="signal-card__viewed-badge">Viewed</span>}
      </div>

      <div className="signal-card__footer">
        {source && (
          <span className="signal-card__source-text">
            {source.publisher ?? source.title}
          </span>
        )}
        <span className="signal-card__cta-text">
          View analysis &rarr;
        </span>
      </div>
    </article>
  )
}

export function SignalCardSkeleton() {
  return (
    <div className="signal-card signal-card--skeleton" aria-hidden="true">
      <div className="skeleton-line skeleton-line--short" />
      <div className="skeleton-line skeleton-line--wide" />
      <div className="skeleton-line skeleton-line--medium" />
      <div className="signal-card__meta">
        <span className="skeleton-badge" />
        <span className="skeleton-badge" />
      </div>
    </div>
  )
}
