// StressScenarioCard — shows Monte Carlo stress test results.
// Three tappable scenario cards: base case, downside, tail risk.

import { useState } from 'react'
import type { StressTestResult } from '@prism/shared'

interface StressScenarioCardProps {
  readonly data: unknown
  readonly onSelect?: (scenario: string) => void
}

function formatDollar(n: number): string {
  const sign = n < 0 ? '-' : '+'
  return `${sign}$${Math.abs(n).toLocaleString()}`
}

export function StressScenarioCard({ data, onSelect }: StressScenarioCardProps) {
  const stress = data as StressTestResult
  const [selected, setSelected] = useState<string | null>(null)

  function handleSelect(scenario: string) {
    setSelected(scenario)
    onSelect?.(scenario)
  }

  const scenarios = [
    { id: 'base', label: 'Most Likely', percentile: '50th', range: stress.baseCase },
    { id: 'downside', label: 'Downside', percentile: '5th', range: stress.downside },
    { id: 'tail', label: 'Tail Risk', percentile: '1st', range: stress.tailRisk },
  ]

  return (
    <div className="chat-card chat-card--stress">
      <h4 className="chat-card__title">Stress Test Results</h4>
      <p className="chat-card__meta">
        {stress.numSimulations.toLocaleString()} simulations &middot;
        {(stress.reversalProbability * 100).toFixed(0)}% reversal probability
      </p>

      <div className="chat-card__scenarios">
        {scenarios.map((s) => (
          <button
            key={s.id}
            className={`chat-card__scenario ${selected === s.id ? 'chat-card__scenario--selected' : ''}`}
            onClick={() => handleSelect(s.id)}
          >
            <span className="chat-card__scenario-label">{s.label}</span>
            <span className="chat-card__scenario-percentile">{s.percentile} %ile</span>
            <span className="chat-card__scenario-mid">{formatDollar(s.range.mid)}</span>
            <span className="chat-card__scenario-range">
              {formatDollar(s.range.low)} to {formatDollar(s.range.high)}
            </span>
          </button>
        ))}
      </div>

      {!selected && (
        <p className="chat-card__hint">Select a scenario to plan for</p>
      )}
    </div>
  )
}
