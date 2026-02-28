// SessionList — shows analysis sessions in the left panel.
// Each signal analysis creates a session. Click to switch, button to create new.

import type { SessionSummary } from '../../hooks/useSessions'

interface SessionListProps {
  readonly sessions: readonly SessionSummary[]
  readonly activeSessionId: string | null
  readonly onSelect: (sessionId: string) => void
  readonly onCreate: (params: {
    type: SessionSummary['type']
    title: string
    signalId?: string
  }) => Promise<string>
  readonly onDelete: (sessionId: string) => Promise<void>
}

const STATUS_LABELS: Record<SessionSummary['status'], string> = {
  pending: 'Pending',
  analyzing: 'Analyzing...',
  checkpoint: 'Waiting for input',
  complete: 'Complete',
  error: 'Error',
}

const STATUS_CLASSES: Record<SessionSummary['status'], string> = {
  pending: 'session-item__status--pending',
  analyzing: 'session-item__status--analyzing',
  checkpoint: 'session-item__status--checkpoint',
  complete: 'session-item__status--complete',
  error: 'session-item__status--error',
}

export function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
}: SessionListProps) {
  function handleNewSession() {
    onCreate({ type: 'general', title: 'New conversation' })
  }

  return (
    <div className="session-list">
      <div className="session-list__header">
        <h3 className="session-list__title">Sessions</h3>
        <button
          className="session-list__new-btn"
          onClick={handleNewSession}
          aria-label="New session"
        >
          +
        </button>
      </div>
      <ul className="session-list__items">
        {sessions.length === 0 && (
          <li className="session-list__empty">No sessions yet</li>
        )}
        {sessions.map((session) => (
          <li
            key={session.id}
            className={`session-item ${session.id === activeSessionId ? 'session-item--active' : ''}`}
            onClick={() => onSelect(session.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSelect(session.id)
            }}
          >
            <div className="session-item__main">
              <span className="session-item__title">{session.title}</span>
              <span className={`session-item__status ${STATUS_CLASSES[session.status]}`}>
                {STATUS_LABELS[session.status]}
              </span>
            </div>
            <div className="session-item__meta">
              <span className="session-item__type">{session.type.replace('_', ' ')}</span>
              <span className="session-item__count">{session.messageCount} msgs</span>
              <button
                className="session-item__delete"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(session.id)
                }}
                aria-label={`Delete ${session.title}`}
              >
                &times;
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
