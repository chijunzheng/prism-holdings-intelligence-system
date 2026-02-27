import { Outlet } from 'react-router-dom'
import type { Signal } from '@prism/shared'
import { useAppContext } from '../../contexts/AppContext'
import { useSignals } from '../../hooks/useSignals'
import { sortSignalsForCards } from '../../components/portfolio/signal-utils'
import { SignalListPanel } from '../../components/signal/SignalListPanel'
import { useMemo } from 'react'
import '../../styles/signals-workspace.css'
import '../../styles/signal-detail.css'
import '../../styles/graph.css'

export interface SignalsOutletContext {
  readonly signals: ReadonlyArray<Signal>
  readonly userId: string
  readonly loading: boolean
}

export function SignalsLayout() {
  const { userId } = useAppContext()
  const { signals, loading } = useSignals(userId)

  const sorted = useMemo(() => sortSignalsForCards(signals), [signals])

  const outletContext: SignalsOutletContext = {
    signals: sorted,
    userId,
    loading,
  }

  return (
    <div className="signals-workspace">
      <SignalListPanel signals={sorted} loading={loading} />
      <Outlet context={outletContext} />
    </div>
  )
}
