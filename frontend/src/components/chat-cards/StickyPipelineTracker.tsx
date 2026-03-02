// StickyPipelineTracker — collapsible pipeline checklist pinned above the chat input.
// Stays expanded throughout pipeline run, fades out on completion.

import { useState, useEffect } from 'react'
import type { PipelineStageInfo } from './types'

interface StickyPipelineTrackerProps {
  readonly stages: readonly PipelineStageInfo[]
  readonly isComplete: boolean
  readonly error?: string
}

const STATUS_ICONS: Record<string, string> = {
  pending: '\u25CB',  // ○
  active: '\u25CF',   // ●
  complete: '\u2713', // ✓
  waiting: '\u25CB',  // ○ (paused)
}

export function StickyPipelineTracker({ stages, isComplete, error }: StickyPipelineTrackerProps) {
  const [expanded, setExpanded] = useState(true)
  const [fading, setFading] = useState(false)

  const completedCount = stages.filter((s) => s.status === 'complete').length
  const activeStage = stages.find((s) => s.status === 'active' || s.status === 'waiting')
  const activeLabel = activeStage?.label ?? 'Processing...'

  // Reset to expanded when a new pipeline starts (all stages pending)
  useEffect(() => {
    const allPending = stages.every((s) => s.status === 'pending' || s.status === 'active')
    if (allPending && completedCount === 0) {
      setExpanded(true)
      setFading(false)
    }
  }, [stages, completedCount])

  // Fade out 2s after complete
  useEffect(() => {
    if (!isComplete) return
    const timer = setTimeout(() => setFading(true), 2000)
    return () => clearTimeout(timer)
  }, [isComplete])

  const containerClass = [
    'sticky-tracker',
    expanded ? 'sticky-tracker--expanded' : 'sticky-tracker--collapsed',
    fading ? 'sticky-tracker--complete' : '',
    error ? 'sticky-tracker--error' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={containerClass}>
      {expanded ? (
        <>
          <button
            type="button"
            className="sticky-tracker__header"
            onClick={() => setExpanded(false)}
          >
            <span className="sticky-tracker__spinner" />
            <span className="sticky-tracker__title">
              {error ? 'Analysis failed' : isComplete ? 'Analysis complete' : 'Analyzing...'}
            </span>
            <span className="sticky-tracker__chevron">{'\u25BE'}</span>
          </button>
          <div className="sticky-tracker__stages">
            {stages.map((stage) => (
              <div key={stage.id} className={`sticky-tracker__stage sticky-tracker__stage--${stage.status}`}>
                <span className={`sticky-tracker__stage-icon sticky-tracker__stage-icon--${stage.status}`}>
                  {stage.status === 'active' ? (
                    <span className="sticky-tracker__stage-spinner" />
                  ) : (
                    STATUS_ICONS[stage.status] ?? STATUS_ICONS.pending
                  )}
                </span>
                <span className="sticky-tracker__stage-label">{stage.label}</span>
                {stage.status === 'active' && stage.thinkingText && (
                  <span className="sticky-tracker__stage-thinking">{stage.thinkingText}</span>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <button
          type="button"
          className="sticky-tracker__header"
          onClick={() => setExpanded(true)}
        >
          <span className="sticky-tracker__spinner" />
          <span className="sticky-tracker__title">
            {error ? 'Analysis failed' : isComplete ? 'Analysis complete' : `Analyzing: ${activeLabel}`}
          </span>
          <span className="sticky-tracker__progress">{completedCount}/{stages.length}</span>
          <span className="sticky-tracker__chevron">{'\u25B8'}</span>
        </button>
      )}
    </div>
  )
}
