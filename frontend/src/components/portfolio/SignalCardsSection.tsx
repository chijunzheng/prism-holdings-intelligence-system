import { useEffect, useMemo, useState } from 'react'
import { type ExposureEntry, type Signal } from '@prism/shared'
import { Link, useNavigate } from 'react-router-dom'
import { SignalCard, SignalCardSkeleton } from './SignalCard'
import {
  getMateriality,
  buildSignalGraphRoute,
  markSignalViewed,
  readViewedSignalIds,
  sortSignalsForCards,
} from './signal-utils'

interface SignalCardsSectionProps {
  readonly userId: string
  readonly signals: ReadonlyArray<Signal>
  readonly loading: boolean
  readonly error: string | null
  readonly mode?: string | null
  readonly requestId?: string | null
  readonly exposures?: ReadonlyArray<ExposureEntry>
  readonly totalPortfolioValue?: number
}

export function SignalCardsSection({
  userId,
  signals,
  loading,
  error,
  exposures = [],
  totalPortfolioValue = 0,
}: SignalCardsSectionProps) {
  const navigate = useNavigate()
  const [viewedSignalIds, setViewedSignalIds] = useState<ReadonlySet<string>>(
    () => readViewedSignalIds(userId),
  )
  useEffect(() => {
    setViewedSignalIds(readViewedSignalIds(userId))
  }, [userId])

  const materialSignals = useMemo(
    () => signals.filter((signal) => getMateriality(signal) !== 'low'),
    [signals],
  )
  const hasOnlyLowPrioritySignals = signals.length > 0 && materialSignals.length === 0
  const orderedSignals = useMemo(
    () => sortSignalsForCards(materialSignals.length > 0 ? materialSignals : signals),
    [materialSignals, signals],
  )
  function handleViewAnalysis(signal: Signal) {
    const nextViewed = markSignalViewed(userId, signal.id)
    setViewedSignalIds(nextViewed)
    navigate(buildSignalGraphRoute(signal.id))
  }

  return (
    <section className="signal-cards-section" id="signal-cards">
      <div className="signal-cards-section__header">
        <h2 className="section-title">Active Signals</h2>
        <Link to="/signals" className="signal-cards-section__overflow-link">
          View all signals &rarr;
        </Link>
      </div>

      {loading && (
        <div className="signal-cards-list">
          <SignalCardSkeleton />
          <SignalCardSkeleton />
        </div>
      )}

      {error && <p className="signal-cards-section__error">Unable to load signals: {error}</p>}

      {!loading && !error && signals.length === 0 && (
        <p className="signal-cards-section__status">
          No active signals right now. Monitoring continues in the background.
        </p>
      )}

      {!loading && !error && hasOnlyLowPrioritySignals && (
        <p className="signal-cards-section__status">
          Showing lower-priority monitoring signals while higher-confidence events are evaluated.
        </p>
      )}

      {!loading && !error && orderedSignals.length > 0 && (
        <div className="signal-cards-list">
          {orderedSignals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              viewed={viewedSignalIds.has(signal.id)}
              onViewAnalysis={handleViewAnalysis}
              exposures={exposures}
              totalPortfolioValue={totalPortfolioValue}
            />
          ))}
        </div>
      )}

    </section>
  )
}
