interface CounterfactualToggleProps {
  readonly enabled: boolean
  readonly available: boolean
  readonly onToggle: (enabled: boolean) => void
}

export function CounterfactualToggle({
  enabled,
  available,
  onToggle,
}: CounterfactualToggleProps) {
  return (
    <label className={`graph-control counterfactual-toggle ${!available ? 'is-disabled' : ''}`}>
      <span className="graph-control__label">Counterfactual</span>
      <span className="counterfactual-toggle__input">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!available}
          onChange={(event) => onToggle(event.target.checked)}
        />
        <span>{enabled ? 'Rebalanced view' : 'Current portfolio'}</span>
      </span>
      {!available && (
        <span className="counterfactual-toggle__hint">No counterfactual scenario available</span>
      )}
    </label>
  )
}
