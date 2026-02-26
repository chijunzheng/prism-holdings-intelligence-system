import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../contexts/AppContext'
import type { PlanSession } from '@prism/shared'
import '../styles/playbook.css'

interface PlaybookState {
  readonly sessions: ReadonlyArray<PlanSession>
  readonly loading: boolean
  readonly error: string | null
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  reviewed: 'Reviewed',
  archived: 'Archived',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PlaybookView() {
  const { userId } = useAppContext()
  const navigate = useNavigate()
  const [state, setState] = useState<PlaybookState>({
    sessions: [],
    loading: true,
    error: null,
  })

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
        <h1 className="playbook__title">Playbook</h1>
        <p className="playbook__subtitle">
          Your saved mitigation plans and strategy evaluations
        </p>
      </div>

      {state.loading ? (
        <div className="playbook__grid">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="playbook-card playbook-card--skeleton">
              <div className="skeleton-line skeleton-line--title" />
              <div className="skeleton-line skeleton-line--subtitle" />
              <div className="skeleton-line skeleton-line--metrics" />
            </div>
          ))}
        </div>
      ) : state.sessions.length === 0 ? (
        <div className="playbook__empty">
          No saved plans yet. Build a plan from any signal.
        </div>
      ) : (
        <div className="playbook__grid">
          {state.sessions.map((session) => (
            <button
              key={session.id}
              className="playbook-card"
              onClick={() => handleCardClick(session)}
              type="button"
            >
              <div className="playbook-card__header">
                <span className={`playbook-card__status playbook-card__status--${session.status}`}>
                  {STATUS_LABELS[session.status] ?? session.status}
                </span>
                <span className="playbook-card__date">{formatDate(session.updatedAt)}</span>
              </div>

              <h3 className="playbook-card__title">{session.title}</h3>
              <p className="playbook-card__signal">{session.signalHeadline}</p>

              {session.affectedExposures.length > 0 && (
                <div className="playbook-card__exposures">
                  {session.affectedExposures.map((exp) => (
                    <span key={exp} className="playbook-card__tag">{exp}</span>
                  ))}
                </div>
              )}

              {session.evaluation && (
                <div className="playbook-card__metrics">
                  <div className="playbook-card__metric">
                    <span className="playbook-card__metric-label">Downside reduction</span>
                    <span className="playbook-card__metric-value">
                      ${Math.abs(session.evaluation.downsideReductionCad).toLocaleString('en-CA', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="playbook-card__metric">
                    <span className="playbook-card__metric-label">Turnover</span>
                    <span className="playbook-card__metric-value">
                      {session.evaluation.turnoverPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="playbook-card__metric">
                    <span className="playbook-card__metric-label">Selections</span>
                    <span className="playbook-card__metric-value">
                      {session.selectedCandidateIds.length}
                    </span>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
