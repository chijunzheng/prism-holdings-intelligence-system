import { useAppContext } from '../../contexts/AppContext'
import type { ConcentrationWarning as WarningType } from '@prism/shared'
import { formatWarningMessage } from './exposure-category'

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
  const { setActiveAskPrismEntryContext, setActiveSidebarContext, setAskPrismOpen } = useAppContext()

  if (warnings.length === 0) return null

  function handleClick(w: WarningType) {
    const message = formatWarningMessage(w.message, w.category)
    setActiveSidebarContext({
      type: 'concentration',
      label: w.category,
      detail: message,
    })
    setActiveAskPrismEntryContext(null)
    setAskPrismOpen(true)
  }

  return (
    <div className="concentration-warnings">
      <h3 className="concentration-warnings__title">Concentration Alerts</h3>
      {warnings.map((w) => (
        <button
          key={w.category}
          type="button"
          className={`concentration-warning concentration-warning--${w.severity} sidebar-clickable`}
          onClick={() => handleClick(w)}
        >
          <span className="concentration-warning__icon">{severityIcon(w.severity)}</span>
          <span className="concentration-warning__message">{formatWarningMessage(w.message, w.category)}</span>
          <span className="sidebar-clickable__chevron">›</span>
        </button>
      ))}
    </div>
  )
}
