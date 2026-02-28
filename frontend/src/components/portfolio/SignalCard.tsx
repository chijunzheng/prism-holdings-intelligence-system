import { useMemo } from 'react'
import type { Signal, ExposureEntry } from '@prism/shared'
import type { KeyboardEvent } from 'react'
import { formatExposureCategory } from './exposure-category'
interface SignalCardProps {
  readonly signal: Signal
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

  const magnitude = signal.urgency === 'critical' ? 0.05
    : signal.urgency === 'high' ? 0.03
    : signal.urgency === 'medium' ? 0.02
    : 0.01
  const narrative = `${signal.headline} ${signal.description}`.toLowerCase()
  const positiveHint = /(strong|beat|growth|upgrade|boost|surge|rally)/.test(narrative)
  const negativeHint = /(tariff|downgrade|decline|drop|risk|tension|shock|selloff)/.test(narrative)
  const direction = positiveHint && !negativeHint ? 1 : -1
  const dollarImpact = affectedValue * magnitude * direction * signal.relevanceScore

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

function getAffectedBuckets(
  signal: Signal,
  exposures: ReadonlyArray<ExposureEntry>,
): ReadonlyArray<string> {
  if (exposures.length === 0) return []
  return exposures
    .filter((e) =>
      signal.affectedExposures.some(
        (ae) =>
          e.category.toLowerCase().includes(ae.toLowerCase()) ||
          ae.toLowerCase().includes(e.category.toLowerCase()),
      ),
    )
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3)
    .map((e) => formatExposureCategory(e.category))
}

function getTemporalDescription(classification: string): string {
  switch (classification) {
    case 'transient': return 'Short-term effect'
    case 'structural': return 'Long-term shift'
    case 'ambiguous': return 'Uncertain duration'
    default: return ''
  }
}

function buildImpactSentence(
  dollarImpact: number,
  affectedPct: number,
): string {
  const direction = dollarImpact < 0 ? 'decline' : 'gain'
  return `Est. ${formatDollarImpact(dollarImpact)} ${direction} across ${affectedPct.toFixed(0)}% of your holdings`
}

export function SignalCard({
  signal,
  viewed,
  onViewAnalysis,
  exposures = [],
  totalPortfolioValue = 0,
}: SignalCardProps) {
  const source = signal.sources[0]
  const impact = estimateImpact(signal, exposures, totalPortfolioValue)
  const temporalDesc = getTemporalDescription(signal.temporalClassification)
  const buckets = useMemo(() => getAffectedBuckets(signal, exposures), [signal, exposures])

  return (
    <article
      className={`signal-card ${viewed ? 'signal-card--viewed' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onViewAnalysis(signal)}
      onKeyDown={(event) => handleCardKeyDown(event, signal, onViewAnalysis)}
    >
      <div className="signal-card__body">
        <h3 className="signal-card__title">{signal.headline}</h3>

        {signal.portfolioSummary ? (
          <p className="signal-card__summary" title={signal.portfolioSummary}>
            {signal.portfolioSummary}
          </p>
        ) : (
          <p className="signal-card__desc" title={signal.description}>{signal.description}</p>
        )}

        {impact && (
          <p className={`signal-card__impact ${impact.dollarImpact < 0 ? 'signal-card__impact--neg' : 'signal-card__impact--pos'}`}>
            {buildImpactSentence(impact.dollarImpact, impact.affectedPct)}
          </p>
        )}

        {(temporalDesc || buckets.length > 0) && (
          <div className="signal-card__meta-row">
            {temporalDesc && (
              <span className="signal-card__temporal">{temporalDesc}</span>
            )}
            {buckets.length > 0 && (
              <div className="signal-card__chips">
                {buckets.map((b) => (
                  <span key={b} className="signal-card__chip">{b}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="signal-card__footer">
        {source?.url ? (
          <a
            className="signal-card__source signal-card__source--link"
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {source.publisher ?? source.title ?? ''}
            <svg className="signal-card__external-icon" width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M3.5 1H11V8.5M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ) : (
          <span className="signal-card__source">
            {source?.publisher ?? source?.title ?? ''}
          </span>
        )}
        <span className="signal-card__action">
          View analysis &rarr;
        </span>
      </div>
    </article>
  )
}

export function SignalCardSkeleton() {
  return (
    <div className="signal-card signal-card--skeleton" aria-hidden="true">
      <div className="signal-card__body">
        <div className="skeleton-line skeleton-line--wide" />
        <div className="skeleton-line skeleton-line--medium" />
        <div className="skeleton-line skeleton-line--short" />
      </div>
      <div className="signal-card__footer">
        <span className="skeleton-badge" />
      </div>
    </div>
  )
}
