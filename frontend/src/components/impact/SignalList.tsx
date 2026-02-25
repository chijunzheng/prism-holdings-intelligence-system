import { useMemo } from 'react'
import type { Signal } from '@prism/shared'
import {
  getMateriality,
  sortSignalsForCards,
} from '../portfolio/signal-utils'
import { SignalCard } from './SignalCard'

interface SignalListProps {
  readonly signals: ReadonlyArray<Signal>
  readonly selectedSignalId: string | undefined
  readonly loading: boolean
  readonly error: string | null
  readonly onSelect: (signalId: string) => void
}

export function SignalList({
  signals,
  selectedSignalId,
  loading,
  error,
  onSelect,
}: SignalListProps) {
  const orderedSignals = useMemo(() => {
    const material = signals.filter((s) => getMateriality(s) !== 'low')
    return sortSignalsForCards(material)
  }, [signals])

  if (loading) {
    return (
      <div className="impact-signal-list">
        <p className="impact-center__status">Scanning signals...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="impact-signal-list">
        <p className="impact-center__status" style={{ color: 'var(--color-negative)' }}>
          {error}
        </p>
      </div>
    )
  }

  if (orderedSignals.length === 0) {
    return (
      <div className="impact-signal-list">
        <p className="impact-center__status">No active signals</p>
      </div>
    )
  }

  return (
    <div className="impact-signal-list">
      {orderedSignals.map((signal) => (
        <SignalCard
          key={signal.id}
          signal={signal}
          selected={signal.id === selectedSignalId}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
