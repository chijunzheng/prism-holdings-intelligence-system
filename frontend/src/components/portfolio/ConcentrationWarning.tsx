import type { ConcentrationWarning as WarningType } from '@prism/shared'

interface ConcentrationWarningProps {
  readonly warnings: ReadonlyArray<WarningType>
}

function severityIcon(severity: WarningType['severity']): string {
  switch (severity) {
    case 'critical':
      return '!!!'
    case 'high':
      return '!!'
    case 'medium':
      return '!'
    case 'low':
      return 'i'
  }
}

export function ConcentrationWarning({ warnings }: ConcentrationWarningProps) {
  if (warnings.length === 0) return null

  return (
    <div className="concentration-warnings">
      <h3 className="concentration-warnings__title">Concentration Alerts</h3>
      {warnings.map((w) => (
        <div key={w.category} className={`concentration-warning concentration-warning--${w.severity}`}>
          <span className="concentration-warning__icon">{severityIcon(w.severity)}</span>
          <span className="concentration-warning__message">{w.message}</span>
        </div>
      ))}
    </div>
  )
}
