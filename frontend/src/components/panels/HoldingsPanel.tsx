// HoldingsPanel — shows portfolio holdings with signal status indicators.
// Tapping a holding sends it as context to the chat.

import type { Portfolio } from '@prism/shared'

interface HoldingsPanelProps {
  readonly portfolio: Portfolio | null | undefined
  readonly isLoading: boolean
  readonly onHoldingClick?: (ticker: string) => void
}

export function HoldingsPanel({ portfolio, isLoading, onHoldingClick }: HoldingsPanelProps) {
  if (isLoading) {
    return (
      <div className="holdings-panel">
        <h3 className="holdings-panel__title">My Holdings</h3>
        <div className="holdings-panel__loading">Loading portfolio...</div>
      </div>
    )
  }

  if (!portfolio) {
    return (
      <div className="holdings-panel">
        <h3 className="holdings-panel__title">My Holdings</h3>
        <div className="holdings-panel__empty">No portfolio data</div>
      </div>
    )
  }

  const allHoldings = portfolio.accounts.flatMap((a) => a.holdings)
  const totalValue = allHoldings.reduce((sum, h) => sum + h.valueCad, 0)
  const sorted = [...allHoldings].sort((a, b) => b.valueCad - a.valueCad)

  return (
    <div className="holdings-panel">
      <div className="holdings-panel__header">
        <h3 className="holdings-panel__title">My Holdings</h3>
        <span className="holdings-panel__total">${totalValue.toLocaleString()}</span>
      </div>
      <ul className="holdings-panel__list">
        {sorted.map((h) => {
          const pct = ((h.valueCad / totalValue) * 100).toFixed(0)
          return (
            <li
              key={h.ticker}
              className="holdings-panel__item"
              onClick={() => onHoldingClick?.(h.ticker)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onHoldingClick?.(h.ticker)
              }}
            >
              <span className="holdings-panel__ticker">{h.ticker}</span>
              <span className="holdings-panel__name">{h.name}</span>
              <span className="holdings-panel__value">${h.valueCad.toLocaleString()}</span>
              <span className="holdings-panel__pct">{pct}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
