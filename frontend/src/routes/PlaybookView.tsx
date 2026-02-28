import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../contexts/AppContext'
import type { PlanSession } from '@prism/shared'
import '../styles/playbook.css'

interface PlaybookState {
  readonly sessions: ReadonlyArray<PlanSession>
  readonly loading: boolean
  readonly error: string | null
}

type PlaybookViewMode = 'grid' | 'list'
type PlaybookStatusFilter = 'all' | 'draft' | 'reviewed'
type PlaybookSortMode = 'recent' | 'impact'
type PlaybookQuickFilter = 'none' | 'needs_attention' | 'high_impact' | 'low_turnover'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  reviewed: 'Reviewed',
  archived: 'Archived',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDollar(value: number): string {
  const abs = Math.abs(value)
  const prefix = value > 0 ? '+' : value < 0 ? '-' : ''
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

function parseViewMode(input: string | null): PlaybookViewMode {
  return input === 'list' ? 'list' : 'grid'
}

function loadInitialViewMode(): PlaybookViewMode {
  if (typeof window === 'undefined') return 'grid'
  return parseViewMode(window.localStorage.getItem('playbook:view-mode'))
}

function resolvePlanHealth(session: PlanSession): {
  readonly label: string
  readonly tone: 'positive' | 'warning' | 'critical' | 'neutral'
} {
  const evaluation = session.evaluation
  if (!evaluation) {
    return { label: 'Needs Review', tone: 'warning' }
  }
  if (!evaluation.objectiveSatisfied || evaluation.turnoverPct > evaluation.turnoverCapPct) {
    return { label: 'Needs Changes', tone: 'critical' }
  }
  if (evaluation.warnings.length > 0 || evaluation.score < 30) {
    return { label: 'Watch', tone: 'warning' }
  }
  return { label: 'Strong', tone: 'positive' }
}

function handleCardKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onOpen: () => void,
): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('button,a,input,textarea,select')) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onOpen()
  }
}

export function PlaybookView() {
  const { userId } = useAppContext()
  const navigate = useNavigate()
  const [state, setState] = useState<PlaybookState>({
    sessions: [],
    loading: true,
    error: null,
  })
  const [viewMode, setViewMode] = useState<PlaybookViewMode>(() => loadInitialViewMode())
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null)
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PlaybookStatusFilter>('all')
  const [sortMode, setSortMode] = useState<PlaybookSortMode>('recent')
  const [quickFilter, setQuickFilter] = useState<PlaybookQuickFilter>('none')

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('playbook:view-mode', viewMode)
  }, [viewMode])

  useEffect(() => {
    const onWindowClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target?.closest('.playbook-card__menu-wrap')) {
        setMenuSessionId(null)
      }
    }
    window.addEventListener('click', onWindowClick)
    return () => window.removeEventListener('click', onWindowClick)
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch(`/api/plans/${userId}`)
      .then((res) => res.json())
      .then((payload: { success: boolean; data?: ReadonlyArray<PlanSession>; error?: string }) => {
        if (cancelled) return
        if (!payload.success || !payload.data) {
          throw new Error(payload.error ?? 'Failed to load plans')
        }
        setState({ sessions: payload.data, loading: false, error: null })
      })
      .catch((err: Error) => {
        if (cancelled) return
        setState({ sessions: [], loading: false, error: err.message })
      })

    return () => { cancelled = true }
  }, [userId])

  const handleCardClick = (session: PlanSession) => {
    navigate(`/signals/${encodeURIComponent(session.signalId)}/plan?sessionId=${encodeURIComponent(session.id)}`)
  }

  const summary = useMemo(() => {
    const total = state.sessions.length
    const reviewed = state.sessions.filter((session) => session.status === 'reviewed').length
    const needsAttention = state.sessions.filter((session) => {
      const health = resolvePlanHealth(session)
      return health.tone === 'critical' || health.tone === 'warning'
    }).length
    const evaluated = state.sessions.filter((session) => session.evaluation !== null)
    const avgDownsideReduction = evaluated.length > 0
      ? evaluated.reduce((sum, session) => sum + (session.evaluation?.downsideReductionCad ?? 0), 0) / evaluated.length
      : 0
    return { total, reviewed, needsAttention, avgDownsideReduction }
  }, [state.sessions])

  const visibleSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    let sessions = state.sessions

    if (query) {
      sessions = sessions.filter((session) =>
        session.title.toLowerCase().includes(query) ||
        session.signalHeadline.toLowerCase().includes(query) ||
        session.signalId.toLowerCase().includes(query),
      )
    }

    if (statusFilter !== 'all') {
      sessions = sessions.filter((session) => session.status === statusFilter)
    }

    if (quickFilter === 'needs_attention') {
      sessions = sessions.filter((session) => {
        const health = resolvePlanHealth(session)
        return health.tone === 'critical' || health.tone === 'warning'
      })
    } else if (quickFilter === 'high_impact') {
      sessions = sessions.filter(
        (session) => Math.abs(session.evaluation?.downsideReductionCad ?? 0) >= 100,
      )
    } else if (quickFilter === 'low_turnover') {
      sessions = sessions.filter(
        (session) => (session.evaluation?.turnoverPct ?? Number.POSITIVE_INFINITY) <= 2.5,
      )
    }

    const sorted = [...sessions]
    if (sortMode === 'impact') {
      sorted.sort((a, b) => {
        const left = Math.abs(a.evaluation?.downsideReductionCad ?? 0)
        const right = Math.abs(b.evaluation?.downsideReductionCad ?? 0)
        if (right !== left) return right - left
        return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      })
      return sorted
    }

    sorted.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    return sorted
  }, [quickFilter, searchQuery, sortMode, state.sessions, statusFilter])

  const handleRenameSession = useCallback(
    async (session: PlanSession) => {
      const nextTitle = window.prompt('Rename plan', session.title)?.trim()
      setMenuSessionId(null)
      if (!nextTitle || nextTitle === session.title) return

      setRenamingSessionId(session.id)
      try {
        const res = await fetch(`/api/plans/${userId}/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: nextTitle }),
        })
        const payload = await res.json() as { success: boolean; data?: PlanSession; error?: string }
        if (!res.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? 'Failed to rename plan')
        }
        setState((prev) => ({
          ...prev,
          sessions: prev.sessions.map((entry) => (
            entry.id === session.id ? payload.data! : entry
          )),
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to rename plan'
        window.alert(message)
      } finally {
        setRenamingSessionId(null)
      }
    },
    [userId],
  )

  const handleDeleteSession = useCallback(
    async (session: PlanSession) => {
      const confirmed = window.confirm(`Delete "${session.title}"? This cannot be undone.`)
      setMenuSessionId(null)
      if (!confirmed) return

      setDeletingSessionId(session.id)
      try {
        const res = await fetch(`/api/plans/${userId}/${session.id}`, {
          method: 'DELETE',
        })
        const payload = await res.json() as { success: boolean; error?: string }
        if (!res.ok || !payload.success) {
          throw new Error(payload.error ?? 'Failed to delete plan')
        }
        setState((prev) => ({
          ...prev,
          sessions: prev.sessions.filter((entry) => entry.id !== session.id),
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete plan'
        window.alert(message)
      } finally {
        setDeletingSessionId(null)
      }
    },
    [userId],
  )

  if (state.error) {
    return (
      <div className="playbook">
        <div className="playbook__header">
          <h1 className="playbook__title">Playbook</h1>
        </div>
        <div className="playbook__error">Failed to load plans: {state.error}</div>
      </div>
    )
  }

  return (
    <div className="playbook">
      <div className="playbook__header">
        <div className="playbook__header-row">
          <div className="playbook__headline">
            <h1 className="playbook__title">Playbook</h1>
            <p className="playbook__subtitle">
              Review, manage, and reopen your mitigation plans.
            </p>
          </div>
          <div className="playbook__summary">
            <div className="playbook__summary-card">
              <span className="playbook__summary-label">Plans</span>
              <strong className="playbook__summary-value">{summary.total}</strong>
            </div>
            <div className="playbook__summary-card">
              <span className="playbook__summary-label">Reviewed</span>
              <strong className="playbook__summary-value">{summary.reviewed}</strong>
            </div>
            <div className="playbook__summary-card">
              <span className="playbook__summary-label">Needs Attention</span>
              <strong className="playbook__summary-value">{summary.needsAttention}</strong>
            </div>
            <div className="playbook__summary-card">
              <span className="playbook__summary-label">Avg reduction</span>
              <strong className="playbook__summary-value">{formatDollar(summary.avgDownsideReduction)}</strong>
            </div>
          </div>
        </div>

        <div className="playbook__controls">
          <input
            className="playbook__search"
            type="search"
            placeholder="Search by title or signal..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />

          <select
            className="playbook__select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as PlaybookStatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="reviewed">Reviewed</option>
          </select>

          <select
            className="playbook__select"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as PlaybookSortMode)}
          >
            <option value="recent">Most recent</option>
            <option value="impact">Largest impact</option>
          </select>

          <div className="playbook__quick-filters" aria-label="Quick filters">
            <button
              type="button"
              className={`playbook__quick-filter${quickFilter === 'none' ? ' playbook__quick-filter--active' : ''}`}
              onClick={() => setQuickFilter('none')}
            >
              All
            </button>
            <button
              type="button"
              className={`playbook__quick-filter${quickFilter === 'needs_attention' ? ' playbook__quick-filter--active' : ''}`}
              onClick={() => setQuickFilter('needs_attention')}
            >
              Needs Attention
            </button>
            <button
              type="button"
              className={`playbook__quick-filter${quickFilter === 'high_impact' ? ' playbook__quick-filter--active' : ''}`}
              onClick={() => setQuickFilter('high_impact')}
            >
              High Impact
            </button>
            <button
              type="button"
              className={`playbook__quick-filter${quickFilter === 'low_turnover' ? ' playbook__quick-filter--active' : ''}`}
              onClick={() => setQuickFilter('low_turnover')}
            >
              Low Turnover
            </button>
          </div>

          <div className="playbook__view-toggle" role="group" aria-label="Playbook view mode">
            <button
              type="button"
              className={`playbook__view-toggle-btn${viewMode === 'grid' ? ' playbook__view-toggle-btn--active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              className={`playbook__view-toggle-btn${viewMode === 'list' ? ' playbook__view-toggle-btn--active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {state.loading ? (
        <div className={`playbook__grid${viewMode === 'list' ? ' playbook__grid--list' : ''}`}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="playbook-card playbook-card--skeleton">
              <div className="skeleton-line skeleton-line--title" />
              <div className="skeleton-line skeleton-line--subtitle" />
              <div className="skeleton-line skeleton-line--metrics" />
            </div>
          ))}
        </div>
      ) : visibleSessions.length === 0 ? (
        <div className="playbook__empty">
          No matching plans. Adjust your filters or search query.
        </div>
      ) : (
        <div className={`playbook__grid${viewMode === 'list' ? ' playbook__grid--list' : ''}`}>
          {visibleSessions.map((session) => {
            const health = resolvePlanHealth(session)
            return (
              <article
                key={session.id}
                className="playbook-card"
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (deletingSessionId || renamingSessionId) return
                  handleCardClick(session)
                }}
                onKeyDown={(event) => handleCardKeyDown(event, () => handleCardClick(session))}
              >
                <div className="playbook-card__body">
                  <div className="playbook-card__meta">
                    <div className="playbook-card__meta-left">
                      <span className={`playbook-card__status playbook-card__status--${session.status}`}>
                        {STATUS_LABELS[session.status] ?? session.status}
                      </span>
                      <span className={`playbook-card__health-badge playbook-card__health-badge--${health.tone}`}>
                        {health.label}
                      </span>
                    </div>
                    <div className="playbook-card__meta-right">
                      <span className="playbook-card__date">{formatDate(session.updatedAt)}</span>
                      <div className="playbook-card__menu-wrap">
                        <button
                          type="button"
                          className="playbook-card__menu-trigger"
                          aria-label="Plan actions"
                          aria-haspopup="menu"
                          aria-expanded={menuSessionId === session.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            setMenuSessionId((prev) => (prev === session.id ? null : session.id))
                          }}
                        >
                          &#8942;
                        </button>
                        {menuSessionId === session.id && (
                          <div className="playbook-card__menu" role="menu">
                            <button
                              type="button"
                              className="playbook-card__menu-item"
                              role="menuitem"
                              disabled={renamingSessionId === session.id || deletingSessionId === session.id}
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleRenameSession(session)
                              }}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              className="playbook-card__menu-item playbook-card__menu-item--danger"
                              role="menuitem"
                              disabled={deletingSessionId === session.id || renamingSessionId === session.id}
                              onClick={(event) => {
                                event.stopPropagation()
                                void handleDeleteSession(session)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <h3 className="playbook-card__title">{session.title}</h3>
                  <p className="playbook-card__signal">{session.signalHeadline}</p>

                  {session.evaluation ? (
                    <p
                      className={`playbook-card__impact ${
                        session.evaluation.downsideReductionCad >= 0
                          ? 'playbook-card__impact--positive'
                          : 'playbook-card__impact--negative'
                      }`}
                    >
                      Downside reduction: {formatDollar(session.evaluation.downsideReductionCad)}
                    </p>
                  ) : (
                    <p className="playbook-card__impact playbook-card__impact--neutral">
                      Evaluation pending
                    </p>
                  )}

                  <div className="playbook-card__metrics">
                    <div className="playbook-card__metric">
                      <span className="playbook-card__metric-label">Turnover</span>
                      <span className="playbook-card__metric-value">
                        {session.evaluation ? `${session.evaluation.turnoverPct.toFixed(1)}%` : '--'}
                      </span>
                    </div>
                    <div className="playbook-card__metric">
                      <span className="playbook-card__metric-label">Selections</span>
                      <span className="playbook-card__metric-value">
                        {session.selectedCandidateIds.length}
                      </span>
                    </div>
                    <div className="playbook-card__metric">
                      <span className="playbook-card__metric-label">Exposures</span>
                      <span className="playbook-card__metric-value">
                        {session.affectedExposures.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="playbook-card__footer">
                  <span className="playbook-card__footer-source">{session.signalId}</span>
                  <span className="playbook-card__cta">View plan &rarr;</span>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
