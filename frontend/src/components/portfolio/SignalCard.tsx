import type { Signal } from '@prism/shared'
import type { KeyboardEvent } from 'react'
import type { Materiality } from './signal-utils'
import { SignalBadge } from './SignalBadge'

interface SignalCardProps {
  readonly signal: Signal
  readonly materiality: Materiality
  readonly viewed: boolean
  readonly onViewAnalysis: (signal: Signal) => void
}

function formatMateriality(materiality: Materiality): string {
  return `${materiality.charAt(0).toUpperCase()}${materiality.slice(1)} materiality`
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
}: SignalCardProps) {
  const source = signal.sources[0]

  return (
    <article
      className={`signal-card signal-card--${signal.temporalClassification} signal-card--${materiality} ${viewed ? 'signal-card--viewed' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onViewAnalysis(signal)}
      onKeyDown={(event) => handleCardKeyDown(event, signal, onViewAnalysis)}
    >
      <h3 className="signal-card__headline">{signal.headline}</h3>
      <p className="signal-card__description">{signal.description}</p>

      <div className="signal-card__meta">
        <SignalBadge classification={signal.temporalClassification} />
        <span className={`signal-card__materiality signal-card__materiality--${materiality}`}>
          {formatMateriality(materiality)}
        </span>
        {viewed && <span className="signal-card__viewed">Viewed</span>}
      </div>

      <div className="signal-card__footer">
        {source && (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="signal-card__source"
            onClick={(event) => event.stopPropagation()}
          >
            Source: {source.publisher ?? source.title}
          </a>
        )}
        <button
          type="button"
          className="signal-card__cta"
          onClick={(event) => {
            event.stopPropagation()
            onViewAnalysis(signal)
          }}
        >
          {viewed ? 'View again →' : 'View analysis →'}
        </button>
      </div>
    </article>
  )
}
