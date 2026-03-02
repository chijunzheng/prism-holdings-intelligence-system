import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppContext } from '../contexts/AppContext'
import { useSignals } from '../hooks/useSignals'
import type { Signal } from '@prism/shared'
import '../styles/explorer-pages.css'

const URGENCY_ORDER: Record<Signal['urgency'], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

function urgencyClass(urgency: Signal['urgency']): string {
  if (urgency === 'critical') return 'signals-feed__badge--critical'
  if (urgency === 'high') return 'signals-feed__badge--high'
  if (urgency === 'medium') return 'signals-feed__badge--medium'
  return 'signals-feed__badge--low'
}

export function SignalsView() {
  const { userId } = useAppContext()
  const { signals, loading, error, lastUpdated } = useSignals(userId)
  const [filter, setFilter] = useState<'all' | Signal['urgency']>('all')

  const sortedSignals = useMemo(() => {
    return [...signals].sort((a, b) => {
      const urgencyDiff = URGENCY_ORDER[b.urgency] - URGENCY_ORDER[a.urgency]
      if (urgencyDiff !== 0) return urgencyDiff
      return b.relevanceScore - a.relevanceScore
    })
  }, [signals])

  const filteredSignals = useMemo(
    () => sortedSignals.filter((signal) => filter === 'all' || signal.urgency === filter),
    [sortedSignals, filter],
  )

  return (
    <div className="explorer-page">
      <header className="explorer-page__header">
        <div>
          <p className="explorer-page__eyebrow">Live Intelligence</p>
          <h1>Signals</h1>
          <p className="explorer-page__subtitle">
            Monitor market events and analyze the ones that matter most to your portfolio.
          </p>
        </div>
        <div className="explorer-page__summary-card">
          <span>Active Signals</span>
          <strong>{signals.length}</strong>
          <small>{lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : 'Polling markets'}</small>
        </div>
      </header>

      <section className="explorer-page__panel">
        <div className="explorer-page__panel-header">
          <div className="signals-feed__filters" role="tablist" aria-label="Signal urgency filter">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={`signals-feed__filter ${filter === value ? 'signals-feed__filter--active' : ''}`}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="explorer-page__empty">Scanning markets...</p>}
        {error && <p className="explorer-page__error">{error}</p>}
        {!loading && !error && filteredSignals.length === 0 && (
          <p className="explorer-page__empty">No signals in this filter.</p>
        )}

        {!loading && !error && filteredSignals.length > 0 && (
          <div className="signals-feed" role="list">
            {filteredSignals.map((signal) => (
              <article key={signal.id} className="signals-feed__card" role="listitem">
                <header className="signals-feed__card-header">
                  <span className={`signals-feed__badge ${urgencyClass(signal.urgency)}`}>
                    {signal.urgency}
                  </span>
                  <span className="signals-feed__sentiment">{signal.sentiment}</span>
                </header>

                <h2>{signal.headline}</h2>
                <p>{signal.description}</p>

                <div className="signals-feed__meta">
                  {signal.affectedExposures.slice(0, 3).map((exposure) => (
                    <span key={exposure} className="signals-feed__meta-pill">
                      {exposure}
                    </span>
                  ))}
                </div>

                {signal.sources[0] && (
                  <a href={signal.sources[0].url} target="_blank" rel="noreferrer" className="explorer-page__source-link">
                    {signal.sources[0].title}
                  </a>
                )}

                <footer className="signals-feed__card-footer">
                  <span>Relevance {(signal.relevanceScore * 100).toFixed(0)}%</span>
                  <Link className="explorer-page__inline-link" to={`/?analyzeSignal=${encodeURIComponent(signal.id)}`}>
                    Analyze in chat
                  </Link>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
