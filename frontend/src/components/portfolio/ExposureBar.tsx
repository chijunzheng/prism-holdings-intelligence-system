import type { ExposureEntry } from '@prism/shared'
import { formatExposureCategory } from './exposure-category'

interface ExposureBarProps {
  readonly entry: ExposureEntry
  readonly maxPercentage: number
  readonly animationDelay: number
}

function getBarColor(percentage: number): string {
  if (percentage >= 40) return '#dc2626'
  if (percentage >= 30) return '#ea580c'
  if (percentage >= 20) return '#ca8a04'
  if (percentage >= 10) return '#1a1a1a'
  return '#d4d4d4'
}

export function ExposureBar({ entry, maxPercentage, animationDelay }: ExposureBarProps) {
  const widthPercent = (entry.percentage / maxPercentage) * 100
  const category = formatExposureCategory(entry.category)

  return (
    <div className="exposure-bar">
      <div className="exposure-bar__header">
        <span className="exposure-bar__label">{category}</span>
        <span className="exposure-bar__value">
          {entry.percentage}% · ${entry.valueCad.toLocaleString('en-CA', { maximumFractionDigits: 0 })}
        </span>
      </div>
      <div className="exposure-bar__track">
        <div
          className="exposure-bar__fill"
          style={{
            width: `${widthPercent}%`,
            backgroundColor: getBarColor(entry.percentage),
            animationDelay: `${animationDelay}ms`,
          }}
        />
      </div>
      <div className="exposure-bar__sources">
        {entry.contributingHoldings.map((h) => (
          <span key={h.ticker} className="exposure-bar__source">
            {h.ticker}: {h.contribution.toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  )
}
