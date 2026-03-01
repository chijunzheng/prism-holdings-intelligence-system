// DebateSummaryCard — shows Bull/Bear debate outcome with clickable disagreements.
// "View Full Debate" opens transcript in Action Center.

import type { DebateResolution } from '@prism/shared'
import type { ActionCenterMode } from './types'

interface DebateSummaryCardProps {
  readonly data: unknown
  readonly onFollowUp?: (query: string) => void
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

export function DebateSummaryCard({ data, onFollowUp, onActionCenterMode }: DebateSummaryCardProps) {
  const debate = data as DebateResolution

  function handleDisagreementClick(disagreement: string) {
    onFollowUp?.(`Tell me more about: ${disagreement}`)
  }

  function handleViewTranscript() {
    onActionCenterMode?.({ mode: 'debate_transcript', debate })
  }

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

      <div className="chat-card__debate-sides">
        <div className="chat-card__debate-side chat-card__debate-side--bull">
          <h5>Bull Concessions</h5>
          <ul>
            {debate.bullConcessions.length > 0
              ? debate.bullConcessions.map((c, i) => <li key={i}>{c}</li>)
              : <li className="chat-card__none">None</li>
            }
          </ul>
        </div>
        <div className="chat-card__debate-side chat-card__debate-side--bear">
          <h5>Bear Concessions</h5>
          <ul>
            {debate.bearConcessions.length > 0
              ? debate.bearConcessions.map((c, i) => <li key={i}>{c}</li>)
              : <li className="chat-card__none">None</li>
            }
          </ul>
        </div>
      </div>

      {debate.unresolvedDisagreements.length > 0 && (
        <div className="chat-card__unresolved">
          <h5>Unresolved</h5>
          <ul>
            {debate.unresolvedDisagreements.map((d, i) => (
              <li
                key={i}
                className="chat-card__unresolved-item"
                role="button"
                tabIndex={0}
                onClick={() => handleDisagreementClick(d)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDisagreementClick(d) }}
              >
                {d}
              </li>
            ))}
          </ul>
        </div>
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
