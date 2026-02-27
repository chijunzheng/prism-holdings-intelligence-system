import { useNavigate, useParams } from 'react-router-dom'
import type { Signal } from '@prism/shared'
import { SignalListItem } from './SignalListItem'

interface SignalListPanelProps {
  readonly signals: ReadonlyArray<Signal>
  readonly loading: boolean
}

export function SignalListPanel({ signals, loading }: SignalListPanelProps) {
  const { signalId } = useParams<{ signalId: string }>()
  const navigate = useNavigate()

  const isAllView = !signalId

  return (
    <aside className="signal-list-panel">
      <div className="signal-list-panel__header">
        <h2 className="signal-list-panel__title">Signals</h2>
        <button
          type="button"
          className={`signal-list-panel__all-btn${isAllView ? ' signal-list-panel__all-btn--active' : ''}`}
          onClick={() => navigate('/signals')}
        >
          All Signals
          {signals.length > 0 && (
            <span>({signals.length})</span>
          )}
        </button>
      </div>

      <div className="signal-list-panel__items">
        {loading && signals.length === 0 ? (
          <p className="signal-list-panel__empty">Loading signals...</p>
        ) : signals.length === 0 ? (
          <p className="signal-list-panel__empty">No active signals. Prism is monitoring.</p>
        ) : (
          signals.map((signal) => (
            <SignalListItem
              key={signal.id}
              signal={signal}
              active={signal.id === signalId}
              onClick={() => navigate(`/signals/${encodeURIComponent(signal.id)}`)}
            />
          ))
        )}
      </div>
    </aside>
  )
}
