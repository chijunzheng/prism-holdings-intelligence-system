import type { ExposureMap } from '@prism/shared'
import { ExposureBar } from './ExposureBar'

interface ExposureXRayProps {
  readonly exposureMap: ExposureMap
}

export function ExposureXRay({ exposureMap }: ExposureXRayProps) {
  const maxPercentage = Math.max(...exposureMap.exposures.map((e) => e.percentage), 1)

  return (
    <div className="exposure-xray">
      <div className="section-header">
        <h2 className="section-title">Exposure X-Ray</h2>
      </div>
      <span className="exposure-xray__subtitle">
        True exposure across all accounts and holdings
      </span>

      <div className="exposure-xray__bars">
        {exposureMap.exposures.map((entry, i) => (
          <ExposureBar
            key={entry.category}
            entry={entry}
            maxPercentage={maxPercentage}
            animationDelay={i * 80}
          />
        ))}
      </div>

      {!exposureMap.dataFreshness.allFresh && (
        <div className="exposure-xray__stale-warning">
          Data may be stale for: {exposureMap.dataFreshness.staleFunds.join(', ')}
        </div>
      )}
    </div>
  )
}
