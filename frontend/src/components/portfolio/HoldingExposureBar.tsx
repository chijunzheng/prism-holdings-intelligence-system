interface ExposureBarItem {
  readonly category: string
  readonly percentage: number
}

interface HoldingExposureBarProps {
  readonly exposures: ReadonlyArray<ExposureBarItem>
}

const COLORS = [
  '#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#4f46e5', '#0d9488', '#ca8a04', '#9333ea',
] as const

export function HoldingExposureBar({ exposures }: HoldingExposureBarProps) {
  if (exposures.length === 0) {
    return <p className="holdings-drawer__empty">No exposure data available for this holding.</p>
  }

  const sorted = [...exposures].sort((a, b) => b.percentage - a.percentage)
  const maxPercentage = sorted[0]?.percentage ?? 0

  return (
    <div className="holding-exposure-bar">
      {sorted.map((item, i) => (
        <div key={item.category} className="holding-exposure-bar__row">
          <div className="holding-exposure-bar__label">{item.category}</div>
          <div className="holding-exposure-bar__track">
            <div
              className="holding-exposure-bar__fill"
              style={{
                width: `${maxPercentage > 0 ? (item.percentage / maxPercentage) * 100 : 0}%`,
                backgroundColor: COLORS[i % COLORS.length],
              }}
            />
          </div>
          <div className="holding-exposure-bar__value">
            {item.percentage.toFixed(1)}%
          </div>
        </div>
      ))}
    </div>
  )
}
