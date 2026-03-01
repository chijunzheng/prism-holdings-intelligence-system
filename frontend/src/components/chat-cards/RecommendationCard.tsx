// RecommendationCard — three-phase state machine:
// 1. choosing: all options clickable (initial)
// 2. selected: chosen option expanded with inline playbook, others collapsed
// 3. saved: compact confirmation with follow-ups

import { useState } from 'react'
import type { Recommendation, RecommendationAction } from '@prism/shared'
import type { ActionCenterMode } from './types'
import { buildPlaybookSteps } from './mappers'
import { TickerIcon } from '../common/TickerIcon'

type Phase = 'choosing' | 'selected' | 'saved'

interface RecommendationCardProps {
  readonly data: unknown
  readonly onSelect?: (id: string) => void
  readonly onSavePlan?: (id: string) => void
  readonly onFollowUp?: (query: string) => void
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

const ACTION_VERBS: Record<RecommendationAction['action'], string> = {
  reduce: 'Reduce',
  increase: 'Increase',
  hold: 'Hold',
  add_new: 'Add',
  remove: 'Remove',
}

function formatChangeCad(amount: number | undefined): string {
  if (amount === undefined) return ''
  const sign = amount >= 0 ? '+' : ''
  return `${sign}$${Math.abs(amount).toLocaleString()}`
}

export function RecommendationCard({
  data,
  onSelect,
  onSavePlan,
  onFollowUp,
  onActionCenterMode,
}: RecommendationCardProps) {
  const recommendations = data as readonly Recommendation[]
  const [phase, setPhase] = useState<Phase>('choosing')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedRec = recommendations.find((r) => r.id === selectedId)

  function handleSelect(id: string) {
    setSelectedId(id)
    setPhase('selected')
    onSelect?.(id)
  }

  function handleSave(recId: string) {
    onSavePlan?.(recId)
    setPhase('saved')
  }

  function handleCompare() {
    onActionCenterMode?.({
      mode: 'comparison',
      recommendations,
    })
  }

  // ── Phase 3: Saved confirmation ──────────────────
  if (phase === 'saved' && selectedRec) {
    return (
      <div className="chat-card chat-card--recommendation">
        <div className="chat-card__rec-saved">
          Plan saved: <strong>{selectedRec.title}</strong>
        </div>
        {onFollowUp && (
          <div className="chat-card__follow-up-pills">
            <button
              type="button"
              className="chat-card__follow-up-pill"
              onClick={() => onFollowUp('What if I do nothing instead?')}
            >
              What if I do nothing?
            </button>
            <button
              type="button"
              className="chat-card__follow-up-pill"
              onClick={() => onFollowUp('How much would this cost in fees?')}
            >
              How much in fees?
            </button>
            <button
              type="button"
              className="chat-card__follow-up-pill"
              onClick={() => onFollowUp('What are the tax implications of this plan?')}
            >
              Tax impact?
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Phase 2: Selected — expanded option + inline playbook ──
  if (phase === 'selected' && selectedRec) {
    const steps = buildPlaybookSteps(selectedRec)

    return (
      <div className="chat-card chat-card--recommendation">
        <h4 className="chat-card__title">Recommendations</h4>
        <div className="chat-card__options">
          {recommendations.map((rec) => {
            if (rec.id === selectedId) {
              return (
                <div
                  key={rec.id}
                  className="chat-card__option chat-card__option--selected chat-card__option--expanded"
                >
                  <div className="chat-card__option-header">
                    <span className="chat-card__option-title">{rec.title}</span>
                    {rec.isDoNothing && <span className="chat-card__baseline-tag">Baseline</span>}
                  </div>
                  <p className="chat-card__option-desc">{rec.description}</p>
                  <div className="chat-card__option-meta">
                    <span>Cost: {rec.estimatedCost}</span>
                    <span>Reduction: {rec.riskReduction}</span>
                  </div>

                  {rec.actions && rec.actions.length > 0 && (
                    <div className="chat-card__option-actions">
                      {rec.actions.map((action) => (
                        <div key={action.ticker} className="chat-card__action-item">
                          <TickerIcon ticker={action.ticker} size={20} />
                          <span className={`chat-card__action-verb chat-card__action-verb--${action.action}`}>
                            {ACTION_VERBS[action.action]}
                          </span>
                          <span className="chat-card__action-ticker">{action.ticker}</span>
                          {action.suggestedChangeCad !== undefined && (
                            <span className="chat-card__action-amount">
                              {formatChangeCad(action.suggestedChangeCad)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline playbook steps */}
                  <div className="chat-card__inline-playbook">
                    <h5>Step-by-step plan</h5>
                    {steps.map((step, i) => (
                      <div key={step.id} className="chat-card__inline-step">
                        <span className="chat-card__inline-step-number">{i + 1}</span>
                        <div className="chat-card__inline-step-content">
                          <span className="chat-card__inline-step-title">{step.title}</span>
                          <span className="chat-card__inline-step-detail">{step.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            // Collapsed alternative
            return (
              <button
                key={rec.id}
                className="chat-card__option chat-card__option--collapsed"
                onClick={() => handleSelect(rec.id)}
              >
                <div className="chat-card__option-header">
                  <span className="chat-card__option-title">{rec.title}</span>
                  <span className="chat-card__baseline-tag">Alternative</span>
                </div>
              </button>
            )
          })}
        </div>

        <div className="chat-card__rec-footer">
          {!selectedRec.isDoNothing && selectedRec.actions && selectedRec.actions.length > 0 && onSavePlan && (
            <button
              type="button"
              className="chat-card__btn chat-card__btn--primary"
              onClick={() => handleSave(selectedRec.id)}
            >
              Save to Watchlist
            </button>
          )}
          {onFollowUp && (
            <button
              type="button"
              className="chat-card__btn chat-card__btn--secondary"
              onClick={() => onFollowUp(`Tell me more about the "${selectedRec.title}" option`)}
            >
              Ask about this
            </button>
          )}
          {recommendations.length > 1 && (
            <button
              type="button"
              className="chat-card__btn chat-card__btn--secondary"
              onClick={handleCompare}
            >
              Compare options
            </button>
          )}
        </div>

        {onFollowUp && (
          <div className="chat-card__follow-up-pills">
            <button
              type="button"
              className="chat-card__follow-up-pill"
              onClick={() => onFollowUp('What if I do nothing instead?')}
            >
              What if I do nothing?
            </button>
            <button
              type="button"
              className="chat-card__follow-up-pill"
              onClick={() => onFollowUp('How much would this cost in fees?')}
            >
              How much in fees?
            </button>
            <button
              type="button"
              className="chat-card__follow-up-pill"
              onClick={() => onFollowUp('What are the tax implications of this plan?')}
            >
              Tax impact?
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Phase 1: Choosing — all options clickable ──────
  return (
    <div className="chat-card chat-card--recommendation">
      <h4 className="chat-card__title">Recommendations</h4>
      <div className="chat-card__options">
        {recommendations.map((rec) => (
          <button
            key={rec.id}
            className={`chat-card__option ${rec.isDoNothing ? 'chat-card__option--baseline' : ''}`}
            onClick={() => handleSelect(rec.id)}
          >
            <div className="chat-card__option-header">
              <span className="chat-card__option-title">{rec.title}</span>
              {rec.isDoNothing && <span className="chat-card__baseline-tag">Baseline</span>}
            </div>
            <p className="chat-card__option-desc">{rec.description}</p>
            <div className="chat-card__option-meta">
              <span>Cost: {rec.estimatedCost}</span>
              <span>Reduction: {rec.riskReduction}</span>
            </div>
            {rec.actions && rec.actions.length > 0 && (
              <div className="chat-card__option-actions">
                {rec.actions.map((action) => (
                  <div key={action.ticker} className="chat-card__action-item">
                    <TickerIcon ticker={action.ticker} size={20} />
                    <span className={`chat-card__action-verb chat-card__action-verb--${action.action}`}>
                      {ACTION_VERBS[action.action]}
                    </span>
                    <span className="chat-card__action-ticker">{action.ticker}</span>
                    {action.suggestedChangeCad !== undefined && (
                      <span className="chat-card__action-amount">
                        {formatChangeCad(action.suggestedChangeCad)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="chat-card__option-tradeoffs">
              {rec.tradeoffs.map((t, i) => (
                <span key={i} className="chat-card__tradeoff-chip">{t}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
