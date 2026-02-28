import { Outlet } from 'react-router-dom'
import type { Signal } from '@prism/shared'
import { useAppContext } from '../../contexts/AppContext'
import { useSignals } from '../../hooks/useSignals'
import { sortSignalsForCards } from '../../components/portfolio/signal-utils'
import { AskPrismDrawer } from '../../components/portfolio/AskPrismDrawer'
import { LoadingDots } from '../../components/common/LoadingDots'
import { useMemo } from 'react'
import '../../styles/signals-workspace.css'
import '../../styles/signal-detail.css'
import '../../styles/graph.css'
import '../../styles/ask-prism-drawer.css'

export interface SignalsOutletContext {
  readonly signals: ReadonlyArray<Signal>
  readonly userId: string
  readonly loading: boolean
}

export function SignalsLayout() {
  const { userId, askPrismOpen, setAskPrismOpen, setActiveAskPrismEntryContext } = useAppContext()
  const { signals, loading } = useSignals(userId)

  const sorted = useMemo(() => sortSignalsForCards(signals), [signals])

  const outletContext: SignalsOutletContext = {
    signals: sorted,
    userId,
    loading,
  }

  return (
    <div className="signals-workspace">
      {loading ? (
        <LoadingDots className="loading-dots--full-page" />
      ) : (
        <Outlet context={outletContext} />
      )}

      {!askPrismOpen && (
        <button
          type="button"
          className="ask-prism-fab"
          onClick={() => {
            setActiveAskPrismEntryContext(null)
            setAskPrismOpen(true)
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          Ask Prism
        </button>
      )}

      {askPrismOpen && (
        <AskPrismDrawer onClose={() => setAskPrismOpen(false)} />
      )}
    </div>
  )
}
