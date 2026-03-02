import { useEffect, useState } from 'react'
import type { RecommendationAction } from '@prism/shared'
import type { ActionPlaybookData } from './types'
import { TickerIcon } from '../common/TickerIcon'

interface ActionPlaybookCardProps {
  readonly data: ActionPlaybookData
  readonly onSelect?: (id: string) => void
  readonly onSavePlan?: (id: string) => void
}

const ACTION_LABELS: Record<RecommendationAction['action'], string> = {
  reduce: 'Reduce',
  increase: 'Increase',
  hold: 'Hold',
  add_new: 'Add',
  remove: 'Remove',
}

export function ActionPlaybookCard({ data, onSelect, onSavePlan }: ActionPlaybookCardProps) {
  const [doneSteps, setDoneSteps] = useState<readonly string[]>([])
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    setDoneSteps([])
    setIsSaved(false)
  }, [data.recommendationId])

  const completedCount = doneSteps.length
  const totalCount = data.steps.length

  function toggleStep(stepId: string) {
    setDoneSteps((prev) => (
      prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId]
    ))
  }

  return (
    <div className="chat-card chat-card--action-playbook">
      <div className="chat-card__playbook-header">
        <div>
          <h4 className="chat-card__title">Recommended Action Playbook</h4>
          <p className="chat-card__description">{data.rationale}</p>
        </div>
        <span className="chat-card__recommended-tag">Recommended</span>
      </div>

      <div className="chat-card__playbook-meta">
        <span>Cost: {data.estimatedCost}</span>
        <span>Risk reduction: {data.riskReduction}</span>
      </div>

      <div className="chat-card__playbook-progress">
        <span>Checklist</span>
        <span>{completedCount}/{totalCount}</span>
      </div>

      <div className="chat-card__playbook-steps">
        {data.steps.map((step) => {
          const checked = doneSteps.includes(step.id)
          return (
            <label key={step.id} className={`chat-card__playbook-step ${checked ? 'chat-card__playbook-step--done' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleStep(step.id)}
              />
              <span className="chat-card__playbook-step-content">
                <span className="chat-card__playbook-step-title">{step.title}</span>
                <span className="chat-card__playbook-step-detail">{step.detail}</span>
              </span>
            </label>
          )
        })}
      </div>

      {data.actions && data.actions.length > 0 && (
        <div className="chat-card__playbook-actions">
          <h5 className="chat-card__playbook-actions-title">Ticker Adjustments</h5>
          {data.actions.map((action) => (
            <div key={action.ticker} className="chat-card__action-item">
              <TickerIcon ticker={action.ticker} size={20} />
              <span className={`chat-card__action-verb chat-card__action-verb--${action.action}`}>
                {ACTION_LABELS[action.action]}
              </span>
              <span className="chat-card__action-ticker">{action.ticker}</span>
              {action.suggestedChangeCad !== undefined && (
                <span className="chat-card__action-amount">
                  {action.suggestedChangeCad >= 0 ? '+' : ''}${Math.abs(action.suggestedChangeCad).toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {onSavePlan && data.actions && data.actions.length > 0 && (
        <button
          type="button"
          className={`chat-card__save-plan-btn ${isSaved ? 'chat-card__save-plan-btn--saved' : ''}`}
          onClick={() => {
            onSavePlan(data.recommendationId)
            setIsSaved(true)
          }}
          disabled={isSaved}
        >
          {isSaved ? 'Saved to Watchlist' : 'Save to Watchlist'}
        </button>
      )}

      {data.alternatives.length > 0 && (
        <div className="chat-card__playbook-alternatives">
          <h5>Alternatives</h5>
          {data.alternatives.map((option) => (
            <button
              key={option.id}
              type="button"
              className="chat-card__alternative-btn"
              onClick={() => onSelect?.(option.id)}
            >
              <span>{option.title}</span>
              <span>{option.riskReduction}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
