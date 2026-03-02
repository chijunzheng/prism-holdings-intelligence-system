// DebateSummaryCard — shows Bull/Bear debate outcome with clickable disagreements.
// "View Full Debate" opens transcript in Action Center.

import type { DebateResolution } from '@prism/shared'
import type { ActionCenterMode } from './types'

interface DebateSummaryCardProps {
  readonly data: unknown
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

export function DebateSummaryCard({ data, onActionCenterMode }: DebateSummaryCardProps) {
  const raw = data as DebateResolution | undefined
  if (!raw) return null

  // Filter out fallback concessions (from JSON parsing failures)
  const debate: DebateResolution = {
    ...raw,
    bullConcessions: (raw.bullConcessions ?? []).filter((c) => !c.startsWith('Fallback applied:')),
    bearConcessions: (raw.bearConcessions ?? []).filter((c) => !c.startsWith('Fallback applied:')),
  }

  function handleViewTranscript() {
    onActionCenterMode?.({ mode: 'debate_transcript', debate })
  }

  const unresolvedCount = debate.unresolvedDisagreements.length

  return (
    <div className="chat-card chat-card--debate">
      <h4 className="chat-card__title">Debate Resolution</h4>
      <div className="chat-card__debate-meta">
        <span>{debate.rounds} rounds</span>
        <span className={`chat-card__direction chat-card__direction--${debate.consensusDirection}`}>
          {debate.consensusDirection}
        </span>
        <span>{(debate.consensusConfidence * 100).toFixed(0)}% confidence</span>
      </div>

      <div className="chat-card__debate-preview">
        {debate.bullConcessions.length > 0 && (
          <div className="chat-card__debate-preview-side">
            <span className="chat-card__debate-preview-label chat-card__debate-preview-label--bull">
              Acknowledged risks
            </span>
            <ul>
              {debate.bullConcessions.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
        {debate.bearConcessions.length > 0 && (
          <div className="chat-card__debate-preview-side">
            <span className="chat-card__debate-preview-label chat-card__debate-preview-label--bear">
              Acknowledged strengths
            </span>
            <ul>
              {debate.bearConcessions.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
        {debate.bullConcessions.length === 0 && debate.bearConcessions.length === 0 && (
          <p className="chat-card__debate-summary">No concessions from either side</p>
        )}
      </div>

      {unresolvedCount > 0 && (
        <p className="chat-card__debate-summary">
          <span className="chat-card__debate-unresolved-count">
            {unresolvedCount} unresolved disagreement{unresolvedCount !== 1 ? 's' : ''}
          </span>
        </p>
      )}

      <div className="chat-card__debate-footer">
        <button
          type="button"
          className="chat-card__btn chat-card__btn--secondary"
          onClick={handleViewTranscript}
        >
          View Full Debate
        </button>
      </div>
    </div>
  )
}
