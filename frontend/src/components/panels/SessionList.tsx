// SessionList — shows analysis sessions in the left panel.
// Starred sessions pin to top. 3-dot menu for rename, star, delete.

import { useCallback, useEffect, useRef, useState } from 'react'
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
  readonly onUpdate: (sessionId: string, params: { title?: string; starred?: boolean }) => void
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

// ── Inline SVG icons (16×16, 1.5px stroke) ────────────────

const Icons = {
  more: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  ),
  rename: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  star: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  starFilled: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
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

// ── Dropdown Menu ────────────────────────────────────

function SessionMenu({
  session,
  onRename,
  onStar,
  onDelete,
}: {
  readonly session: SessionSummary
  readonly onRename: () => void
  readonly onStar: () => void
  readonly onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="session-menu" ref={menuRef}>
      <button
        className="session-menu__trigger"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        aria-label="Session options"
      >
        {Icons.more}
      </button>

      {open && (
        <div className="session-menu__dropdown">
          <button
            className="session-menu__item"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onRename()
            }}
          >
            {Icons.rename}
            <span>Rename</span>
          </button>
          <button
            className="session-menu__item"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onStar()
            }}
          >
            {session.starred ? Icons.starFilled : Icons.star}
            <span>{session.starred ? 'Unstar' : 'Star'}</span>
          </button>
          <div className="session-menu__divider" />
          <button
            className="session-menu__item session-menu__item--danger"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
              onDelete()
            }}
          >
            {Icons.trash}
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ── Session Item ────────────────────────────────────

function SessionItem({
  session,
  isActive,
  onSelect,
  onUpdate,
  onDelete,
}: {
  readonly session: SessionSummary
  readonly isActive: boolean
  readonly onSelect: () => void
  readonly onUpdate: (params: { title?: string; starred?: boolean }) => void
  readonly onDelete: () => void
}) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(session.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const typeLabel = TYPE_LABELS[session.type]
  const statusLabel = ACTIVE_STATUS_LABELS[session.status]

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== session.title) {
      onUpdate({ title: trimmed })
    }
    setIsRenaming(false)
  }, [renameValue, session.title, onUpdate])

  // Focus input when rename starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  return (
    <li
      className={`session-item ${isActive ? 'session-item--active' : ''}`}
      onClick={isRenaming ? undefined : onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isRenaming) onSelect()
      }}
    >
      <div className="session-item__row">
        <span
          className="session-item__dot"
          style={{ backgroundColor: STATUS_DOT_COLORS[session.status] }}
        />

        {isRenaming ? (
          <input
            ref={inputRef}
            className="session-item__rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            onClick={(e) => e.stopPropagation()}
            maxLength={200}
          />
        ) : (
          <span className="session-item__title">{session.title}</span>
        )}

        <span className="session-item__time">
          {formatRelativeTime(session.updatedAt)}
        </span>

        <SessionMenu
          session={session}
          onRename={() => {
            setRenameValue(session.title)
            setIsRenaming(true)
          }}
          onStar={() => onUpdate({ starred: !session.starred })}
          onDelete={onDelete}
        />
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
}

// ── Main SessionList ────────────────────────────────

export function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onCreate,
  onUpdate,
  onDelete,
  showHeader = true,
}: SessionListProps) {
  function handleNewSession() {
    onCreate({ type: 'general', title: 'New conversation' })
  }

  // Sort: starred first, then by updatedAt (already sorted by server, but starred needs client sort)
  const sortedSessions = [...sessions].sort((a, b) => {
    const aStarred = a.starred ? 1 : 0
    const bStarred = b.starred ? 1 : 0
    if (aStarred !== bStarred) return bStarred - aStarred
    return 0 // preserve server order (updatedAt desc) within each group
  })

  const starredSessions = sortedSessions.filter((s) => s.starred)
  const recentSessions = sortedSessions.filter((s) => !s.starred)

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

      {sessions.length === 0 && (
        <p className="session-list__empty">
          Start by tapping a holding or asking a question
        </p>
      )}

      {starredSessions.length > 0 && (
        <>
          <div className="session-list__group-label">Starred</div>
          <ul className="session-list__items">
            {starredSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={() => onSelect(session.id)}
                onUpdate={(params) => onUpdate(session.id, params)}
                onDelete={() => onDelete(session.id)}
              />
            ))}
          </ul>
        </>
      )}

      {recentSessions.length > 0 && (
        <>
          {starredSessions.length > 0 && (
            <div className="session-list__group-label">Recents</div>
          )}
          <ul className="session-list__items">
            {recentSessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={() => onSelect(session.id)}
                onUpdate={(params) => onUpdate(session.id, params)}
                onDelete={() => onDelete(session.id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
