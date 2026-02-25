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
      <div title="Adjust the time horizon to see how impact changes over 1 week, 1 month, or 6 months">
        <TimeSlider value={horizon} onChange={onHorizonChange} />
      </div>

      <div title="Compare your current portfolio against a rebalanced version to see how diversification would reduce impact">
        <CounterfactualToggle
          enabled={counterfactualEnabled}
          available={counterfactualAvailable}
          onToggle={onCounterfactualToggle}
        />
      </div>

      <button
        type="button"
        className="graph-control graph-control--button"
        onClick={onExpandToggle}
        title="Show or hide individual stock-level nodes (3rd-order effects) in the causal graph"
      >
        {expandedDepth ? 'Collapse 3rd-order' : 'Expand 3rd-order'}
      </button>

      <GraphLegend />
    </div>
  )
}
