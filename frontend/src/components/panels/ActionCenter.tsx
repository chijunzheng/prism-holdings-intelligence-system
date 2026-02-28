import { useEffect, useState } from 'react'
import type {
  ActionPlaybookData,
  ReasoningTraceData,
  SignalImpactDeltaData,
} from '../chat-cards/types'

interface ActionCenterProps {
  readonly impactDelta?: SignalImpactDeltaData
  readonly playbook?: ActionPlaybookData
  readonly reasoningTrace?: ReasoningTraceData
}

export function ActionCenter({ impactDelta, playbook, reasoningTrace }: ActionCenterProps) {
  const [checked, setChecked] = useState<readonly string[]>([])

  useEffect(() => {
    setChecked([])
  }, [playbook?.recommendationId])

  function toggleStep(stepId: string) {
    setChecked((prev) => (
      prev.includes(stepId)
        ? prev.filter((id) => id !== stepId)
        : [...prev, stepId]
    ))
  }

  const hasInsights = Boolean(impactDelta || playbook || reasoningTrace)

  return (
    <aside className="action-center">
      <div className="action-center__header">
        <h3>Action Center</h3>
        <p>What to do now, with full traceability.</p>
      </div>

      {!hasInsights && (
        <div className="action-center__empty">
          Run signal analysis to populate actionable guidance and full logic trace.
        </div>
      )}

      {impactDelta && (
        <section className="action-center__section">
          <h4>Signal Effect</h4>
          <p>{impactDelta.summary}</p>
          <div className={`action-center__impact ${impactDelta.netImpactMidCad < 0 ? 'action-center__impact--negative' : 'action-center__impact--positive'}`}>
            {impactDelta.netImpactMidCad > 0 ? '+' : ''}${Math.round(impactDelta.netImpactMidCad).toLocaleString()}
          </div>
        </section>
      )}

      {playbook && (
        <section className="action-center__section">
          <h4>Recommended Plan</h4>
          <p className="action-center__plan-title">{playbook.title}</p>
          <p className="action-center__plan-rationale">{playbook.rationale}</p>
          <div className="action-center__meta">
            <span>Cost: {playbook.estimatedCost}</span>
            <span>Reduction: {playbook.riskReduction}</span>
          </div>
          <div className="action-center__checklist">
            {playbook.steps.map((step) => (
              <label key={step.id} className="action-center__check-item">
                <input
                  type="checkbox"
                  checked={checked.includes(step.id)}
                  onChange={() => toggleStep(step.id)}
                />
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.detail}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
      )}

      {reasoningTrace && (
        <section className="action-center__section">
          <h4>Logic Chain</h4>
          <p>{reasoningTrace.summary}</p>
          <div className="action-center__trace-count">
            {reasoningTrace.steps.length} stage updates captured
          </div>
        </section>
      )}
    </aside>
  )
}
