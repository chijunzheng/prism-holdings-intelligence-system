import type { GraphTimeHorizon } from '../../types/graph'
import { TimeSlider } from '../graph/TimeSlider'
import { CounterfactualToggle } from '../graph/CounterfactualToggle'
import { GraphLegend } from '../graph/GraphLegend'

interface ControlsSidebarProps {
  readonly horizon: GraphTimeHorizon
  readonly onHorizonChange: (value: GraphTimeHorizon) => void
  readonly counterfactualEnabled: boolean
  readonly counterfactualAvailable: boolean
  readonly onCounterfactualToggle: (enabled: boolean) => void
  readonly expandedDepth: boolean
  readonly onExpandToggle: () => void
}

export function ControlsSidebar({
  horizon,
  onHorizonChange,
  counterfactualEnabled,
  counterfactualAvailable,
  onCounterfactualToggle,
  expandedDepth,
  onExpandToggle,
}: ControlsSidebarProps) {
  return (
    <div className="controls-sidebar">
      <TimeSlider value={horizon} onChange={onHorizonChange} />

      <CounterfactualToggle
        enabled={counterfactualEnabled}
        available={counterfactualAvailable}
        onToggle={onCounterfactualToggle}
      />

      <button
        type="button"
        className="graph-control graph-control--button"
        onClick={onExpandToggle}
      >
        {expandedDepth ? 'Collapse 3rd-order' : 'Expand 3rd-order'}
      </button>

      <GraphLegend />
    </div>
  )
}
