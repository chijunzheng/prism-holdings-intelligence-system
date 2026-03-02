// SoftCheckpointCard — Wealthsimple-style checkpoint card.
// Clean rows with weight-based hierarchy, warm neutrals, generous whitespace.
// Clicking a row opens Action Center drawer with full assessment details.

import { useState, useRef, useCallback } from 'react'
import type { SoftCheckpointData, ActionCenterMode } from './types'
import type { AnalystAssessment, DebateResolution, FundManagerVerdict, RiskChallenge } from '@prism/shared'

interface SoftCheckpointCardProps {
  readonly data: SoftCheckpointData
  readonly onSubmit?: (value: string) => void
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

const STAGE_LABELS: Readonly<Record<string, string>> = {
  analyst_review: 'Analyst Perspectives',
  debate_resolution: 'Debate Resolution',
  risk_challenge_review: 'Assumption Challenges',
  verdict_preview: 'Verdict Preview',
}

const SUBMITTED_LABELS: Readonly<Record<string, string>> = {
  analyst_review: 'Analyst perspectives reviewed',
  debate_resolution: 'Debate reviewed',
  risk_challenge_review: 'Challenges reviewed',
  verdict_preview: 'Verdict reviewed',
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
  const debateResolution = data.debateResolution && typeof data.debateResolution === 'object'
    ? (data.debateResolution as DebateResolution)
    : undefined
  const verdict = data.verdict && typeof data.verdict === 'object'
    ? (data.verdict as FundManagerVerdict)
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

      {/* Debate resolution summary */}
      {data.stage === 'debate_resolution' && debateResolution && (
        <div className="soft-cp__debate-summary">
          <div className="soft-cp__debate-outcome">
            <span className={`soft-cp__debate-direction soft-cp__row-direction--${debateResolution.consensusDirection}`}>
              {DIRECTION_LABEL[debateResolution.consensusDirection] ?? debateResolution.consensusDirection}
            </span>
            <span className="soft-cp__debate-confidence">
              {Math.round(debateResolution.consensusConfidence * 100)}% confidence
            </span>
            <span className="soft-cp__debate-rounds">
              {debateResolution.rounds} round{debateResolution.rounds !== 1 ? 's' : ''}
            </span>
          </div>
          {debateResolution.bullConcessions.length > 0 && (
            <div className="soft-cp__debate-concessions">
              <span className="soft-cp__debate-concessions-label">Acknowledged risks:</span>
              {debateResolution.bullConcessions.slice(0, 2).map((c) => (
                <span key={c} className="soft-cp__debate-concession">{c}</span>
              ))}
            </div>
          )}
          {debateResolution.bearConcessions.length > 0 && (
            <div className="soft-cp__debate-concessions">
              <span className="soft-cp__debate-concessions-label">Acknowledged strengths:</span>
              {debateResolution.bearConcessions.slice(0, 2).map((c) => (
                <span key={c} className="soft-cp__debate-concession">{c}</span>
              ))}
            </div>
          )}
          {debateResolution.unresolvedDisagreements.length > 0 && (
            <div className="soft-cp__debate-unresolved">
              {debateResolution.unresolvedDisagreements.length} unresolved disagreement{debateResolution.unresolvedDisagreements.length !== 1 ? 's' : ''}
            </div>
          )}
          {onActionCenterMode && (
            <button
              type="button"
              className="soft-cp__row"
              onClick={() => onActionCenterMode({ mode: 'debate_transcript', debate: debateResolution })}
            >
              <span className="soft-cp__row-detail">View full debate transcript</span>
              <span className="soft-cp__row-chevron" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Verdict preview — rich summary of fund manager synthesis */}
      {data.stage === 'verdict_preview' && verdict && (
        <VerdictPreviewSection verdict={verdict} qualityScore={data.qualityScore} />
      )}

      {/* Prompt summary for stages without specialized rendering */}
      {data.stage !== 'analyst_review' && data.stage !== 'debate_resolution' && data.stage !== 'risk_challenge_review' && data.stage !== 'verdict_preview' && data.prompt && (
        <p className="soft-cp__prompt">{data.prompt}</p>
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

      {/* Fallback: show prompt/assessment when no challenge rows render */}
      {data.stage === 'risk_challenge_review' && (!riskChallenge || riskChallenge.challengedAssumptions.length === 0) && (
        <p className="soft-cp__prompt">
          {riskChallenge?.overallAssessment ?? data.prompt ?? 'Risk team analysis complete. Review before continuing.'}
        </p>
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

// ── Verdict Preview Sub-Component ─────────────────────────
function formatDollar(value: number): string {
  const abs = Math.abs(Math.round(value))
  const formatted = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs}`
  return value < 0 ? `-${formatted}` : `+${formatted}`
}

/** Split a wall-of-text paragraph into individual bullet points on sentence boundaries. */
function splitIntoBullets(text: string): readonly string[] {
  // Split on ". " or ".." (LLM sometimes double-dots) followed by uppercase or end
  const raw = text
    .split(/\.\.?\s+(?=[A-Z])/)
    .map((s) => s.replace(/\.+$/, '').trim())
    .filter((s) => s.length > 0)
  return raw
}

function VerdictPreviewSection({
  verdict,
  qualityScore,
}: {
  readonly verdict: FundManagerVerdict
  readonly qualityScore?: number
}) {
  const qScore = qualityScore ?? verdict.qualityScore
  const qPct = Math.round(qScore * 100)

  // Compute net 1M impact across holdings
  const totalMid = verdict.holdingImpacts.reduce((sum, h) => {
    const m1 = h.impact['1M']
    return sum + (m1 ? m1.mid : 0)
  }, 0)
  const direction = totalMid < -50 ? 'negative' : totalMid > 50 ? 'positive' : 'neutral'

  return (
    <div className="soft-cp__verdict">
      {/* Net impact header */}
      <div className="soft-cp__verdict-header">
        <span className={`soft-cp__verdict-impact soft-cp__verdict-impact--${direction}`}>
          {formatDollar(totalMid)}
        </span>
        <span className="soft-cp__verdict-label">estimated 1-month net impact</span>
        <span className={`soft-cp__verdict-quality${qPct >= 80 ? ' soft-cp__verdict-quality--high' : ''}`}>
          {qPct}% quality
        </span>
      </div>

      {/* Holding impacts */}
      {verdict.holdingImpacts.length > 0 && (
        <div className="soft-cp__verdict-holdings">
          {verdict.holdingImpacts.map((h) => {
            const m1 = h.impact['1M']
            const mid = m1 ? m1.mid : 0
            const low = m1 ? m1.low : 0
            const high = m1 ? m1.high : 0
            const holdDir = mid < -10 ? 'negative' : mid > 10 ? 'positive' : 'neutral'
            return (
              <div key={h.ticker} className="soft-cp__verdict-holding">
                <span className="soft-cp__verdict-ticker">{h.ticker}</span>
                <span className={`soft-cp__verdict-holding-impact soft-cp__verdict-impact--${holdDir}`}>
                  {formatDollar(mid)}
                </span>
                <span className="soft-cp__verdict-range">
                  {formatDollar(low)} to {formatDollar(high)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Bull / Bear perspectives as bullet lists */}
      <div className="soft-cp__verdict-perspectives">
        <div className="soft-cp__verdict-perspective">
          <span className="soft-cp__verdict-perspective-label soft-cp__verdict-perspective-label--bull">Bull case</span>
          <ul className="soft-cp__verdict-bullets">
            {splitIntoBullets(verdict.perspectiveBreakdown.bullCase).map((point, i) => (
              <li key={i} className="soft-cp__verdict-bullet">{point}</li>
            ))}
          </ul>
        </div>
        <div className="soft-cp__verdict-perspective">
          <span className="soft-cp__verdict-perspective-label soft-cp__verdict-perspective-label--bear">Bear case</span>
          <ul className="soft-cp__verdict-bullets">
            {splitIntoBullets(verdict.perspectiveBreakdown.bearCase).map((point, i) => (
              <li key={i} className="soft-cp__verdict-bullet">{point}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Unresolved disagreements */}
      {verdict.perspectiveBreakdown.unresolvedDisagreements.length > 0 && (
        <div className="soft-cp__verdict-unresolved">
          {verdict.perspectiveBreakdown.unresolvedDisagreements.length} unresolved disagreement{verdict.perspectiveBreakdown.unresolvedDisagreements.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
