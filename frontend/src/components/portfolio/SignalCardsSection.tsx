import { useEffect, useMemo, useRef, useState } from 'react'
import { MAX_ACTIVE_SIGNALS, type ExposureEntry, type Signal } from '@prism/shared'
import { Link, useNavigate } from 'react-router-dom'
import { SignalCard, SignalCardSkeleton } from './SignalCard'
import { InAppNotification } from './InAppNotification'
import {
  getMateriality,
  buildSignalGraphRoute,
  getVisibleSignals,
  markSignalViewed,
  readViewedSignalIds,
  sortSignalsForCards,
} from './signal-utils'

interface SignalCardsSectionProps {
  readonly userId: string
  readonly signals: ReadonlyArray<Signal>
  readonly loading: boolean
  readonly error: string | null
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
  const [notificationSignal, setNotificationSignal] = useState<Signal | null>(null)
  const lastNotifiedSignalId = useRef<string | null>(null)

  useEffect(() => {
    setViewedSignalIds(readViewedSignalIds(userId))
    setNotificationSignal(null)
    lastNotifiedSignalId.current = null
  }, [userId])

  const materialSignals = useMemo(
    () => signals.filter((signal) => getMateriality(signal) !== 'low'),
    [signals],
  )
  const orderedSignals = useMemo(() => sortSignalsForCards(materialSignals), [materialSignals])
  const visibleSignals = useMemo(
    () => getVisibleSignals(orderedSignals, MAX_ACTIVE_SIGNALS),
    [orderedSignals],
  )
  const topHighSignal = useMemo(
    () =>
      orderedSignals.find(
        (signal) => getMateriality(signal) === 'high' && !viewedSignalIds.has(signal.id),
      ) ?? null,
    [orderedSignals, viewedSignalIds],
  )

  useEffect(() => {
    if (!topHighSignal) return
    if (lastNotifiedSignalId.current === topHighSignal.id) return
    lastNotifiedSignalId.current = topHighSignal.id
    setNotificationSignal(topHighSignal)
  }, [topHighSignal])

  useEffect(() => {
    if (!notificationSignal) return
    const timer = window.setTimeout(() => {
      setNotificationSignal(null)
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [notificationSignal])

  function handleViewAnalysis(signal: Signal) {
    const nextViewed = markSignalViewed(userId, signal.id)
    setViewedSignalIds(nextViewed)
    setNotificationSignal(null)
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

      {!loading && !error && orderedSignals.length === 0 && (
        <p className="signal-cards-section__status">
          No material signals right now. Monitoring continues in the background.
        </p>
      )}

      {!loading && !error && visibleSignals.length > 0 && (
        <div className="signal-cards-list">
          {visibleSignals.map((signal) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              materiality={getMateriality(signal)}
              viewed={viewedSignalIds.has(signal.id)}
              onViewAnalysis={handleViewAnalysis}
              exposures={exposures}
              totalPortfolioValue={totalPortfolioValue}
            />
          ))}
        </div>
      )}

      <InAppNotification
        signal={notificationSignal}
        materiality="high"
        onDismiss={() => setNotificationSignal(null)}
        onOpenAnalysis={handleViewAnalysis}
      />
    </section>
  )
}
