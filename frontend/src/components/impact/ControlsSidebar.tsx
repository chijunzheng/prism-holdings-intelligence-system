import type { GraphTimeHorizon } from '../../types/graph'
import { TimeSlider } from '../graph/TimeSlider'
import { GraphLegend } from '../graph/GraphLegend'

interface ControlsSidebarProps {
  readonly horizon: GraphTimeHorizon
  readonly onHorizonChange: (value: GraphTimeHorizon) => void
}

export function ControlsSidebar({
  horizon,
  onHorizonChange,
}: ControlsSidebarProps) {
  return (
    <div className="controls-sidebar">
      <div
        className="controls-sidebar__section"
        title="Adjust the time horizon to see how impact changes over 1 week, 1 month, or 6 months"
      >
        <TimeSlider value={horizon} onChange={onHorizonChange} />
      </div>

      <div className="controls-sidebar__section">
        <GraphLegend />
      </div>
    </div>
  )
}
