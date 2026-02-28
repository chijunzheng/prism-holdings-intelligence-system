import { useState } from 'react'
import type { ReasoningTraceData } from './types'

interface ReasoningTraceCardProps {
  readonly data: ReasoningTraceData
}

export function ReasoningTraceCard({ data }: ReasoningTraceCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="chat-card chat-card--reasoning-trace">
      <button
        className="chat-card__expand-trigger"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <span>Full Logic Chain</span>
        <span className="chat-card__chevron">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>

      <p className="chat-card__summary">{data.summary}</p>

      {expanded && (
        <div className="chat-card__expanded">
          <div className="chat-card__trace-grid">
            {data.riskProfile && (
              <div className="chat-card__trace-block">
                <h5>Risk Profile</h5>
                <p>
                  {data.riskProfile.riskTolerance} tolerance ({data.riskProfile.riskScore}/100)
                </p>
              </div>
            )}
            {data.debateResolution && (
              <div className="chat-card__trace-block">
                <h5>Debate Outcome</h5>
                <p>
                  {data.debateResolution.consensusDirection} with {Math.round(data.debateResolution.consensusConfidence * 100)}% confidence
                </p>
              </div>
            )}
            {data.riskChallenge && (
              <div className="chat-card__trace-block">
                <h5>Assumption Challenges</h5>
                <p>
                  {data.riskChallenge.challengedAssumptions.length} challenged assumptions,
                  haircut {Math.round(data.riskChallenge.recommendedConfidenceAdjustment * 100)}%
                </p>
              </div>
            )}
            {data.magnitudeValidation && (
              <div className="chat-card__trace-block">
                <h5>Magnitude Validation</h5>
                <p>
                  {data.magnitudeValidation.outOfBoundsFlags.length} out-of-bounds flags corrected
                </p>
              </div>
            )}
            {data.stressTest && (
              <div className="chat-card__trace-block">
                <h5>Stress Test</h5>
                <p>
                  Tail risk midpoint: ${Math.round(data.stressTest.tailRisk.mid).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {data.steps.length > 0 && (
            <div className="chat-card__trace-chronology">
              <h5>Stage Chronology</h5>
              <ol>
                {data.steps.map((step) => (
                  <li key={`${step.stageId}-${step.summary}`}>
                    <strong>{step.stageLabel}</strong>: {step.summary}
                    {step.detail ? <span> ({step.detail})</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
