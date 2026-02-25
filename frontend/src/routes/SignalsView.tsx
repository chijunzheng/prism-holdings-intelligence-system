import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../contexts/AppContext'
import { useSignals } from '../hooks/useSignals'
import {
  getMateriality,
  buildSignalGraphRoute,
  sortSignalsForCards,
} from '../components/portfolio/signal-utils'
import type { Signal } from '@prism/shared'
import '../styles/signals.css'

function formatTimeAgo(dateString: string): string {
  const now = Date.now()
  const then = Date.parse(dateString)
  const diffMs = now - then

  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `about ${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export function SignalsView() {
  const { userId } = useAppContext()
  const navigate = useNavigate()
  const { signals, loading, error } = useSignals(userId)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const materialSignals = useMemo(
    () => signals.filter((signal) => getMateriality(signal) !== 'low'),
    [signals],
  )
  const orderedSignals = useMemo(() => sortSignalsForCards(materialSignals), [materialSignals])

  function handleToggle(signalId: string) {
    setExpandedId((prev) => (prev === signalId ? null : signalId))
  }

  function handleViewAnalysis(signal: Signal) {
    navigate(buildSignalGraphRoute(signal.id))
  }

  return (
    <div className="signals-view">
      <div className="signals-view__header">
        <h1 className="signals-view__title">Impact Analysis</h1>
        <p className="signals-view__subtitle">
          Select a market signal to trace its impact through your holdings
        </p>
      </div>

      {loading && (
        <p className="signals-view__loading">
          Scanning live market events for material signals...
        </p>
      )}

      {error && <p className="signals-view__error">Unable to load signals: {error}</p>}

      {!loading && !error && orderedSignals.length === 0 && (
        <p className="signals-view__empty">
          No signals detected. Monitoring continues in the background.
        </p>
      )}

      {!error && orderedSignals.length > 0 && (
        <div className="signals-view__list">
          {orderedSignals.map((signal) => {
            const isExpanded = expandedId === signal.id
            const source = signal.sources[0]

            return (
              <article key={signal.id} className="signal-item">
                <button
                  type="button"
                  className="signal-item__header"
                  onClick={() => handleToggle(signal.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="signal-item__header-content">
                    <span className="signal-item__meta">
                      {source?.publisher ?? 'Market Signal'}
                      <span className="signal-item__time">
                        {formatTimeAgo(signal.detectedAt)}
                      </span>
                    </span>
                    <h3 className="signal-item__headline">{signal.headline}</h3>
                  </div>
                  <span className={`signal-item__chevron ${isExpanded ? 'signal-item__chevron--open' : ''}`}>
                    &#8964;
                  </span>
                </button>

                {isExpanded && (
                  <div className="signal-item__body">
                    <p className="signal-item__description">{signal.description}</p>

                    <div className="signal-item__details">
                      <span className={`signal-item__badge signal-item__badge--${signal.temporalClassification}`}>
                        {signal.temporalClassification}
                      </span>
                      <span className="signal-item__affected">
                        Affects: {signal.affectedExposures.join(', ')}
                      </span>
                    </div>

                    <div className="signal-item__actions">
                      {source && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="signal-item__source-link"
                        >
                          {source.title}
                        </a>
                      )}
                      <button
                        type="button"
                        className="signal-item__cta"
                        onClick={() => handleViewAnalysis(signal)}
                      >
                        View impact analysis &rarr;
                      </button>
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
