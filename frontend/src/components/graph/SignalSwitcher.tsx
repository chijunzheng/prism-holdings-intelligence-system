import type { Signal } from '@prism/shared'

interface SignalSwitcherProps {
  readonly signals: ReadonlyArray<Signal>
  readonly activeSignalId: string | undefined
  readonly onSelect: (signalId: string) => void
}

export function SignalSwitcher({
  signals,
  activeSignalId,
  onSelect,
}: SignalSwitcherProps) {
  const hasOptions = signals.length > 0

  return (
    <label className="graph-control signal-switcher">
      <span className="graph-control__label">Signal</span>
      <select
        value={activeSignalId ?? ''}
        onChange={(event) => onSelect(event.target.value)}
        disabled={!hasOptions}
      >
        {!hasOptions && <option value="">No active signals</option>}
        {signals.map((signal) => (
          <option key={signal.id} value={signal.id}>
            {signal.headline}
          </option>
        ))}
      </select>
    </label>
  )
}
