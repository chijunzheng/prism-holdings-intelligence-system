// AgentProgressGroup — inline pipeline stream in the main chat.
// Renders a vertical list of AgentProgressLine components.
// Active stage auto-expands; auto-collapses when complete.

import { AgentProgressLine } from './AgentProgressLine'
import type { ActionCenterMode, AgentProgressGroupData } from './types'

interface AgentProgressGroupProps {
  readonly data: AgentProgressGroupData
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

// Stages whose output is substantive enough to be expandable
const SUBSTANTIVE_STAGES = new Set([
  'analyst_complete', 'debate_complete', 'risk_challenge',
  'magnitude_validation', 'stress_complete', 'verdict', 'judge',
])

export function AgentProgressGroup({ data, onActionCenterMode }: AgentProgressGroupProps) {
  const hasError = Boolean(data.error)

  return (
    <div className="agent-progress-group">
      <div className="agent-progress-group__header">
        <span className="agent-progress-group__icon">
          {hasError ? '\u2717' : data.isComplete ? '\u2713' : '\u25C7'}
        </span>
        <span className="agent-progress-group__headline">
          {hasError ? 'Analysis failed' : data.isComplete ? 'Analysis complete' : 'Analyzing...'}
        </span>
      </div>
      {hasError && (
        <p className="agent-progress-group__error">{data.error}</p>
      )}
      <div className="agent-progress-group__stages">
        {data.stages.map((stage) => (
          <AgentProgressLine
            key={stage.id}
            stage={{
              ...stage,
              expandable: SUBSTANTIVE_STAGES.has(stage.id),
            }}
            autoExpand
            intermediateArtifacts={data.intermediateArtifacts}
            onActionCenterMode={onActionCenterMode}
          />
        ))}
      </div>
    </div>
  )
}
