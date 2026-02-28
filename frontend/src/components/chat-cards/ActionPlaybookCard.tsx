import { useEffect, useState } from 'react'
import type { ActionPlaybookData } from './types'

interface ActionPlaybookCardProps {
  readonly data: ActionPlaybookData
  readonly onSelect?: (id: string) => void
}

export function ActionPlaybookCard({ data, onSelect }: ActionPlaybookCardProps) {
  const [doneSteps, setDoneSteps] = useState<readonly string[]>([])

  useEffect(() => {
    setDoneSteps([])
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
