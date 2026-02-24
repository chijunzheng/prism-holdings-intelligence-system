import type { ExposureEntry } from '@prism/shared'

interface ExposureBarProps {
  readonly entry: ExposureEntry
  readonly maxPercentage: number
  readonly animationDelay: number
}

/**
 * Color coding based on concentration level.
 * Warm colors for high concentration draw attention.
 */
function getBarColor(percentage: number): string {
  if (percentage >= 40) return 'var(--color-negative)'
  if (percentage >= 30) return '#f97316'
  if (percentage >= 20) return 'var(--color-ambiguous)'
  if (percentage >= 10) return 'var(--color-accent)'
  return 'var(--color-text-muted)'
}

export function ExposureBar({ entry, maxPercentage, animationDelay }: ExposureBarProps) {
  const widthPercent = (entry.percentage / maxPercentage) * 100

  return (
    <div className="exposure-bar">
      <div className="exposure-bar__header">
        <span className="exposure-bar__label">{entry.category}</span>
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
