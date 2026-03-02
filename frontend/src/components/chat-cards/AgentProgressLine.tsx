// AgentProgressLine — compact single-line display for one pipeline stage.
// Pending: dimmed. Active: spinner + optional streaming text. Complete: checkmark.
// Expandable stages can be clicked to show/hide full reasoning.
// Completed stages with artifacts are clickable to open Action Center details.

import { useState, useEffect, useRef } from 'react'
import type { ActionCenterMode, AgentProgressGroupData, AgentStageState } from './types'
import type { AnalystAssessment } from '@prism/shared'

interface AgentProgressLineProps {
  readonly stage: AgentStageState
  readonly autoExpand?: boolean
  readonly intermediateArtifacts?: AgentProgressGroupData['intermediateArtifacts']
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

const STATUS_ICONS: Record<AgentStageState['status'], string> = {
  pending: '\u25C7',  // ◇
  active: '\u25C9',   // ◉
  complete: '\u2713', // ✓
}

const ANALYST_TYPES = ['macro', 'fundamental', 'sentiment', 'technical'] as const

/** Detect if a history entry is a generic "evaluating..." message vs. substantive findings */
function isGenericThinking(entry: string): boolean {
  return /evaluating signal impact|analyzing\.\.\.|building.*cases?$/i.test(entry)
}

/** Extract analyst type from a history entry like "macro analyst: bearish outlook..." */
function extractAnalystType(entry: string): typeof ANALYST_TYPES[number] | null {
  for (const t of ANALYST_TYPES) {
    if (entry.toLowerCase().startsWith(`${t} analyst`)) return t
  }
  return null
}

/** Find matching AnalystAssessment from artifacts for a given analyst type */
function findAssessment(
  artifacts: AgentProgressLineProps['intermediateArtifacts'],
  analystType: string,
): AnalystAssessment | undefined {
  return artifacts?.analystAssessments?.find((a) => a.analystType === analystType)
}

/** Check if entry relates to debate */
function isDebateEntry(entry: string): boolean {
  return /bull.*bear|bear.*bull|debate|round \d/i.test(entry)
}

/** Check if entry relates to risk challenge */
function isRiskChallengeEntry(entry: string): boolean {
  return /challeng|assumption|blind spot|overconfident/i.test(entry)
}

/** Map stage IDs to ActionCenterMode actions when artifacts are available */
function getStageDrawerAction(
  stageId: string,
  artifacts: AgentProgressLineProps['intermediateArtifacts'],
): ActionCenterMode | null {
  if (!artifacts) return null

  switch (stageId) {
    case 'analyst_complete':
      if (artifacts.analystAssessments && artifacts.analystAssessments.length > 0) {
        return { mode: 'analyst_picker', assessments: artifacts.analystAssessments }
      }
      return null
    case 'debate_complete':
      if (artifacts.debateResolution) {
        return { mode: 'debate_transcript', debate: artifacts.debateResolution }
      }
      return null
    case 'risk_challenge':
      if (artifacts.riskChallenge) {
        return { mode: 'assumption_challenges', riskChallenge: artifacts.riskChallenge }
      }
      return null
    case 'magnitude_validation':
      if (artifacts.magnitudeValidation) {
        return { mode: 'magnitude_detail', magnitudeValidation: artifacts.magnitudeValidation }
      }
      return null
    case 'stress_complete':
      if (artifacts.stressTest) {
        return { mode: 'stress_detail', stressTest: artifacts.stressTest }
      }
      return null
    default:
      return null
  }
}

export function AgentProgressLine({ stage, autoExpand = false, intermediateArtifacts, onActionCenterMode }: AgentProgressLineProps) {
  const [expanded, setExpanded] = useState(false)
  const prevStatusRef = useRef(stage.status)

  // Auto-expand when a stage becomes active; auto-collapse only on the
  // active → complete transition (not on every render where status IS complete).
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = stage.status

    if (stage.status === 'active' && autoExpand && stage.thinkingText) {
      setExpanded(true)
    }
    if (stage.status === 'complete' && prev === 'active' && autoExpand) {
      setExpanded(false)
    }
  }, [stage.status, autoExpand, stage.thinkingText])

  const history = stage.thinkingHistory ?? []
  // Filter out generic "evaluating..." messages — only show substantive entries
  const substantiveHistory = history.filter((entry) => !isGenericThinking(entry))
  const hasHistory = substantiveHistory.length > 0

  const canExpand = stage.expandable && (
    (stage.status === 'active' && (stage.thinkingText || hasHistory)) ||
    (stage.status === 'complete' && (stage.completionMessage || hasHistory))
  )

  // Whether clicking the completed stage header opens the drawer (instead of expand/collapse)
  const drawerAction = stage.status === 'complete'
    ? getStageDrawerAction(stage.id, intermediateArtifacts)
    : null
  const hasDrawer = drawerAction !== null && onActionCenterMode !== undefined

  function handleHeaderClick(): void {
    if (hasDrawer && onActionCenterMode) {
      onActionCenterMode(drawerAction!)
      return
    }
    if (canExpand) {
      setExpanded(!expanded)
    }
  }

  function handleHistoryClick(entry: string): void {
    if (!onActionCenterMode) return

    // Try to match analyst entry
    const analystType = extractAnalystType(entry)
    if (analystType) {
      const assessment = findAssessment(intermediateArtifacts, analystType)
      if (assessment) {
        onActionCenterMode({ mode: 'analyst_detail', assessment })
        return
      }
    }

    // Try debate entry
    if (isDebateEntry(entry) && intermediateArtifacts?.debateResolution) {
      onActionCenterMode({
        mode: 'debate_transcript',
        debate: intermediateArtifacts.debateResolution,
      })
      return
    }

    // Try risk challenge entry
    if (isRiskChallengeEntry(entry) && intermediateArtifacts?.riskChallenge) {
      onActionCenterMode({
        mode: 'assumption_challenges',
        riskChallenge: intermediateArtifacts.riskChallenge,
      })
    }
  }

  /** Check if a history entry can open the drawer */
  function isClickable(entry: string): boolean {
    if (!onActionCenterMode) return false
    const analystType = extractAnalystType(entry)
    if (analystType && findAssessment(intermediateArtifacts, analystType)) return true
    if (isDebateEntry(entry) && intermediateArtifacts?.debateResolution) return true
    if (isRiskChallengeEntry(entry) && intermediateArtifacts?.riskChallenge) return true
    return false
  }

  return (
    <div className={`agent-progress-line agent-progress-line--${stage.status}`}>
      <button
        type="button"
        className={`agent-progress-line__header${hasDrawer ? ' agent-progress-line__header--drawer' : ''}`}
        onClick={handleHeaderClick}
        disabled={!canExpand && !hasDrawer}
      >
        <span className={`agent-progress-line__icon agent-progress-line__icon--${stage.status}`}>
          {stage.status === 'active' ? (
            <span className="agent-progress-line__spinner" />
          ) : (
            STATUS_ICONS[stage.status]
          )}
        </span>
        <span className="agent-progress-line__label">{stage.label}</span>
        {hasDrawer && (
          <span className="agent-progress-line__drawer-hint">View details &rsaquo;</span>
        )}
        {!hasDrawer && canExpand && (
          <span className="agent-progress-line__toggle">
            {expanded ? '\u25BC' : '\u25B6'}
          </span>
        )}
      </button>
      {stage.status === 'active' && stage.thinkingText && !expanded && (
        <div className="agent-progress-line__thinking-preview">
          {stage.thinkingText}
        </div>
      )}
      {expanded && (
        <div className="agent-progress-line__expand">
          {stage.status === 'complete' && stage.completionMessage && (
            <p className="agent-progress-line__detail">{stage.completionMessage}</p>
          )}
          {hasHistory && (
            <details className="agent-progress-line__history" open>
              <summary className="agent-progress-line__history-summary">
                {substantiveHistory.length} step{substantiveHistory.length !== 1 ? 's' : ''}
              </summary>
              <ul className="agent-progress-line__history-list">
                {substantiveHistory.map((entry, idx) => {
                  const clickable = isClickable(entry)
                  return (
                    <li
                      key={idx}
                      className={`agent-progress-line__history-item${clickable ? ' agent-progress-line__history-item--clickable' : ''}`}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? () => handleHistoryClick(entry) : undefined}
                      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') handleHistoryClick(entry) } : undefined}
                    >
                      {clickable && <span className="agent-progress-line__row-arrow">&rarr;</span>}
                      {entry}
                    </li>
                  )
                })}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
