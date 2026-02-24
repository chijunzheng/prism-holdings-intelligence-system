import type { ExposureMap } from '@prism/shared'

interface MonitoringStatusProps {
  readonly exposureMap: ExposureMap | null
}

export function MonitoringStatus({ exposureMap }: MonitoringStatusProps) {
  const categoryCount = exposureMap?.exposures.length ?? 0

  return (
    <div className="monitoring-status">
      <span className="monitoring-status__dot" />
      <span className="monitoring-status__text">
        Monitoring {categoryCount} exposure categories for relevant market signals
      </span>
    </div>
  )
}
