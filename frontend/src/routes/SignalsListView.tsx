import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../contexts/AppContext'
import { useSignals } from '../hooks/useSignals'
import { useExposureData } from '../hooks/useExposureData'
import { usePortfolio } from '../hooks/usePortfolio'
import { SignalCard, SignalCardSkeleton } from '../components/portfolio/SignalCard'
import { sortSignalsForCards, readViewedSignalIds, markSignalViewed } from '../components/portfolio/signal-utils'
import { useState, useMemo } from 'react'
import type { Signal } from '@prism/shared'
import '../styles/signals-list.css'

export function SignalsListView() {
  const { userId } = useAppContext()
  const { signals, loading, error } = useSignals(userId)
  const { exposureMap } = useExposureData(userId)
  const { portfolio } = usePortfolio(userId)
  const navigate = useNavigate()
  const totalValue = portfolio?.totalValueCad ?? 0

  const [viewedIds, setViewedIds] = useState<ReadonlySet<string>>(
    () => readViewedSignalIds(userId),
  )

  const sorted = useMemo(() => sortSignalsForCards(signals), [signals])

  const handleViewAnalysis = (signal: Signal) => {
    setViewedIds(markSignalViewed(userId, signal.id))
    navigate(`/signals/${encodeURIComponent(signal.id)}`)
  }

  if (error) {
    return (
      <div className="signals-list">
        <div className="signals-list__header">
          <h1 className="signals-list__title">Active Signals</h1>
        </div>
        <div className="signals-list__error">Failed to load signals: {error}</div>
      </div>
    )
  }

  return (
    <div className="signals-list">
      <div className="signals-list__header">
        <h1 className="signals-list__title">Active Signals</h1>
        <p className="signals-list__subtitle">
          Live market events relevant to your portfolio exposures
        </p>
      </div>

      {loading ? (
        <div className="signals-list__grid">
          {Array.from({ length: 3 }, (_, i) => (
            <SignalCardSkeleton key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="signals-list__empty">
          No active signals. Prism is monitoring.
        </div>
      ) : (
        <div className="signals-list__grid">
          {sorted.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              viewed={viewedIds.has(signal.id)}
              onViewAnalysis={handleViewAnalysis}
              exposures={exposureMap?.exposures}
              totalPortfolioValue={totalValue}
            />
          ))}
        </div>
      )}
    </div>
  )
}
