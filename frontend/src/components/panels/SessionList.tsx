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
  readonly showHeader?: boolean
}

const STATUS_DOT_COLORS: Record<SessionSummary['status'], string> = {
  pending: 'var(--color-text-muted, #A1A1AA)',
  analyzing: 'var(--color-ambiguous, #c87d15)',
  checkpoint: '#6b5ce7',
  complete: 'var(--color-positive, #0da750)',
  error: 'var(--color-negative, #d92b2b)',
}

const ACTIVE_STATUS_LABELS: Partial<Record<SessionSummary['status'], string>> = {
  analyzing: 'Analyzing...',
  checkpoint: 'Waiting for input',
}

const TYPE_LABELS: Partial<Record<SessionSummary['type'], string>> = {
  signal: 'Signal analysis',
  portfolio_review: 'Portfolio review',
  holding: 'Holding deep-dive',
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return diffDays === 1 ? 'Yesterday' : `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onDelete,
  showHeader = true,
}: SessionListProps) {
  function handleNewSession() {
    onCreate({ type: 'general', title: 'New conversation' })
  }

  return (
    <div className="session-list">
      {showHeader && (
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
      )}
      <ul className="session-list__items">
        {sessions.length === 0 && (
          <li className="session-list__empty">
            Start by tapping a holding or asking a question
          </li>
        )}
        {sessions.map((session) => {
          const typeLabel = TYPE_LABELS[session.type]
          const statusLabel = ACTIVE_STATUS_LABELS[session.status]

          return (
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
              <div className="session-item__row">
                <span
                  className="session-item__dot"
                  style={{ backgroundColor: STATUS_DOT_COLORS[session.status] }}
                />
                <span className="session-item__title">{session.title}</span>
                <span className="session-item__time">
                  {formatRelativeTime(session.updatedAt)}
                </span>
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
              {(typeLabel || statusLabel) && (
                <div className="session-item__sub">
                  {typeLabel && <span className="session-item__type">{typeLabel}</span>}
                  {typeLabel && statusLabel && <span className="session-item__sep">&middot;</span>}
                  {statusLabel && (
                    <span className={`session-item__status session-item__status--${session.status}`}>
                      {statusLabel}
                    </span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
