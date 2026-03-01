// SoftCheckpointCard — auto-continuing checkpoint with countdown timer.
// Shows a compact summary, counts down from 8s, and auto-submits 'continue'.
// User can tap "Let me review" to cancel the timer and provide input.

import { useState, useEffect, useRef, useCallback } from 'react'
import type { SoftCheckpointData } from './types'

interface SoftCheckpointCardProps {
  readonly data: SoftCheckpointData
  readonly autoResumeMs?: number
  readonly onSubmit?: (value: string) => void
}

const STAGE_LABELS: Readonly<Record<string, string>> = {
  analyst_review: 'Analyst Perspectives',
  risk_challenge_review: 'Assumption Challenges',
  verdict_preview: 'Verdict Preview',
}

export function SoftCheckpointCard({
  data,
  autoResumeMs = 8000,
  onSubmit,
}: SoftCheckpointCardProps) {
  const [mode, setMode] = useState<'countdown' | 'review' | 'submitted'>('countdown')
  const [remainingMs, setRemainingMs] = useState(autoResumeMs)
  const [inputValue, setInputValue] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)

  const handleSubmit = useCallback(
    (value: string) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setMode('submitted')
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      onSubmit?.(value)
    },
    [onSubmit],
  )

  // Countdown timer
  useEffect(() => {
    if (mode !== 'countdown') return

    const interval = 100
    timerRef.current = setInterval(() => {
      setRemainingMs((prev) => {
        const next = prev - interval
        if (next <= 0) {
          handleSubmit('continue')
          return 0
        }
        return next
      })
    }, interval)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [mode, handleSubmit])

  const stageLabel = STAGE_LABELS[data.stage] ?? data.stage.replace(/_/g, ' ')
  const progressPct = Math.max(0, (remainingMs / autoResumeMs) * 100)
  const remainingSec = Math.ceil(remainingMs / 1000)

  if (mode === 'submitted') {
    return (
      <div className="chat-card chat-card--soft-checkpoint chat-card--soft-checkpoint-submitted">
        <span className="chat-card__check">&#10003;</span>
        <span>Continuing analysis...</span>
      </div>
    )
  }

  return (
    <div className="chat-card chat-card--soft-checkpoint">
      <div className="soft-checkpoint__header">
        <span className="soft-checkpoint__label">{stageLabel}</span>
        {mode === 'countdown' && (
          <span className="soft-checkpoint__countdown">
            Continuing in {remainingSec}s
          </span>
        )}
      </div>

      <p className="soft-checkpoint__prompt">{data.prompt}</p>

      {mode === 'countdown' && (
        <>
          <div className="soft-checkpoint__progress-track">
            <div
              className="soft-checkpoint__progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <button
            className="chat-card__btn chat-card__btn--secondary soft-checkpoint__review-btn"
            onClick={() => {
              setMode('review')
              if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
              }
            }}
          >
            Let me review
          </button>
        </>
      )}

      {mode === 'review' && (
        <div className="soft-checkpoint__review">
          <input
            type="text"
            className="chat-card__text-input"
            placeholder="Type your correction or feedback..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                handleSubmit(inputValue.trim())
              }
            }}
            autoFocus
          />
          <div className="soft-checkpoint__actions">
            <button
              className="chat-card__btn chat-card__btn--primary"
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
