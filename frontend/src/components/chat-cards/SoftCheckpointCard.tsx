// SoftCheckpointCard — Wealthsimple-style checkpoint card.
// Clean rows with weight-based hierarchy, warm neutrals, generous whitespace.
// Clicking a row opens Action Center drawer with full assessment details.

import { useState, useRef, useCallback } from 'react'
import type { SoftCheckpointData, ActionCenterMode } from './types'
import type { AnalystAssessment, RiskChallenge } from '@prism/shared'

interface SoftCheckpointCardProps {
  readonly data: SoftCheckpointData
  readonly onSubmit?: (value: string) => void
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

const STAGE_LABELS: Readonly<Record<string, string>> = {
  analyst_review: 'Analyst Perspectives',
  risk_challenge_review: 'Assumption Challenges',
  verdict_preview: 'Verdict Preview',
}

const SUBMITTED_LABELS: Readonly<Record<string, string>> = {
  analyst_review: 'Analyst perspectives reviewed',
  risk_challenge_review: 'Challenges reviewed',
}

const DIRECTION_LABEL: Readonly<Record<string, string>> = {
  positive: 'Bullish',
  negative: 'Bearish',
  neutral: 'Neutral',
  mixed: 'Mixed',
}

function toTitleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function SoftCheckpointCard({
  data,
  onSubmit,
  onActionCenterMode,
}: SoftCheckpointCardProps) {
  const [mode, setMode] = useState<'idle' | 'review' | 'submitted'>('idle')
  const [inputValue, setInputValue] = useState('')
  const submittedRef = useRef(false)

  const handleSubmit = useCallback(
    (value: string) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setMode('submitted')
      onSubmit?.(value)
    },
    [onSubmit],
  )

  const stageLabel = STAGE_LABELS[data.stage] ?? data.stage.replace(/_/g, ' ')
  const submittedLabel = SUBMITTED_LABELS[data.stage] ?? 'Continuing analysis...'

  const assessments = Array.isArray(data.analystAssessments)
    ? (data.analystAssessments as readonly AnalystAssessment[])
    : undefined
  const riskChallenge = data.riskChallenge && typeof data.riskChallenge === 'object'
    ? (data.riskChallenge as RiskChallenge)
    : undefined

  if (mode === 'submitted') {
    return (
      <div className="chat-card chat-card--soft-checkpoint chat-card--soft-checkpoint-submitted">
        <span className="chat-card__check">&#10003;</span>
        <span>{submittedLabel}</span>
      </div>
    )
  }

  return (
    <div className="chat-card chat-card--soft-checkpoint">
      <h3 className="soft-cp__title">{stageLabel}</h3>

      {/* Analyst rows */}
      {data.stage === 'analyst_review' && assessments && assessments.length > 0 && (
        <div className="soft-cp__list">
          {assessments.map((a) => (
            <button
              key={a.analystType}
              type="button"
              className="soft-cp__row"
              onClick={() => onActionCenterMode?.({ mode: 'analyst_detail', assessment: a })}
            >
              <span className="soft-cp__row-name">{toTitleCase(a.analystType)}</span>
              <span className={`soft-cp__row-direction soft-cp__row-direction--${a.overallDirection}`}>
                {DIRECTION_LABEL[a.overallDirection] ?? a.overallDirection}
              </span>
              <span className="soft-cp__row-detail">
                {a.keyAssumptions[0] ?? ''}
              </span>
              <span className="soft-cp__row-chevron" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {/* Challenge rows */}
      {data.stage === 'risk_challenge_review' && riskChallenge && riskChallenge.challengedAssumptions.length > 0 && (
        <div className="soft-cp__list">
          {riskChallenge.challengedAssumptions.map((c) => {
            const pct = Math.round(c.likelihoodOfBeingWrong * 100)
            return (
              <button
                key={`${c.analystType}-${c.assumption}`}
                type="button"
                className="soft-cp__row"
                onClick={() => onActionCenterMode?.({ mode: 'assumption_challenges', riskChallenge })}
              >
                <span className="soft-cp__row-name">{toTitleCase(c.analystType)}</span>
                <span className="soft-cp__row-detail">{c.assumption}</span>
                <span className={`soft-cp__row-pct${pct >= 50 ? ' soft-cp__row-pct--high' : ''}`}>{pct}%</span>
                <span className="soft-cp__row-chevron" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      )}

      {/* Actions */}
      {mode === 'idle' && (
        <div className="soft-cp__actions">
          <button
            className="soft-cp__btn soft-cp__btn--secondary"
            onClick={() => setMode('review')}
          >
            I have feedback
          </button>
          <button
            className="soft-cp__btn soft-cp__btn--primary"
            onClick={() => handleSubmit('continue')}
          >
            Continue
          </button>
        </div>
      )}

      {mode === 'review' && (
        <div className="soft-cp__review">
          <input
            type="text"
            className="soft-cp__input"
            placeholder="e.g. I think the macro outlook is too bearish..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                handleSubmit(inputValue.trim())
              }
            }}
            autoFocus
          />
          <div className="soft-cp__actions">
            <button
              className="soft-cp__btn soft-cp__btn--secondary"
              onClick={() => setMode('idle')}
            >
              Cancel
            </button>
            <button
              className="soft-cp__btn soft-cp__btn--primary"
              onClick={() => handleSubmit(inputValue.trim() || 'continue')}
            >
              {inputValue.trim() ? 'Submit' : 'Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
