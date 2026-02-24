import type { GraphTimeHorizon } from '../../types/graph'

interface TimeSliderProps {
  readonly value: GraphTimeHorizon
  readonly onChange: (value: GraphTimeHorizon) => void
}

const OPTIONS: ReadonlyArray<{ value: GraphTimeHorizon; label: string }> = [
  { value: 'oneWeek', label: '1W' },
  { value: 'oneMonth', label: '1M' },
  { value: 'sixMonth', label: '6M' },
]

export function TimeSlider({ value, onChange }: TimeSliderProps) {
  return (
    <div className="graph-control time-slider" role="group" aria-label="Time horizon">
      <span className="graph-control__label">Projection</span>
      <div className="time-slider__options">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`time-slider__option ${value === option.value ? 'is-active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
