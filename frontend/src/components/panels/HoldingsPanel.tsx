// HoldingsPanel — shows portfolio holdings grouped by account type.
// Tapping a holding sends it as context to the chat.

import type { Portfolio } from '@prism/shared'

interface HoldingsPanelProps {
  readonly portfolio: Portfolio | null | undefined
  readonly isLoading: boolean
  readonly onHoldingClick?: (ticker: string) => void
}

// Deterministic color based on ticker string
const ICON_COLORS = [
  '#2563EB', '#7C3AED', '#0891B2', '#059669',
  '#D97706', '#DC2626', '#4F46E5', '#0D9488',
] as const

function tickerColor(ticker: string): string {
  let hash = 0
  for (let i = 0; i < ticker.length; i++) {
    hash = ((hash << 5) - hash + ticker.charCodeAt(i)) | 0
  }
  return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length]
}

const ACCOUNT_LABELS: Record<string, string> = {
  TFSA: 'TFSA',
  RRSP: 'RRSP',
  FHSA: 'FHSA',
  LIRA: 'LIRA',
  NON_REGISTERED: 'Non-Registered',
}

function SkeletonRows() {
  return (
    <div className="holdings-panel__skeleton">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="holdings-panel__skeleton-row">
          <div className="holdings-panel__skeleton-circle" />
          <div className="holdings-panel__skeleton-bar holdings-panel__skeleton-bar--short" />
          <div className="holdings-panel__skeleton-bar holdings-panel__skeleton-bar--value" />
        </div>
      ))}
    </div>
  )
}

export function HoldingsPanel({ portfolio, isLoading, onHoldingClick }: HoldingsPanelProps) {
  if (isLoading) {
    return (
      <div className="holdings-panel">
        <h3 className="holdings-panel__title">My Holdings</h3>
        <SkeletonRows />
      </div>
    )
  }

  if (!portfolio) {
    return (
      <div className="holdings-panel">
        <h3 className="holdings-panel__title">My Holdings</h3>
        <div className="holdings-panel__empty">
          Connect your portfolio to get started
        </div>
      </div>
    )
  }

  const allHoldings = portfolio.accounts.flatMap((a) => a.holdings)
  const totalValue = allHoldings.reduce((sum, h) => sum + h.valueCad, 0)

  return (
    <div className="holdings-panel">
      <div className="holdings-panel__header">
        <h3 className="holdings-panel__title">My Holdings</h3>
        <span className="holdings-panel__total">${totalValue.toLocaleString()}</span>
      </div>
      {portfolio.accounts.map((account) => {
        const label = ACCOUNT_LABELS[account.type] ?? account.type
        const isFhsa = account.type === 'FHSA'

        return (
          <div key={account.id} className="holdings-panel__account-group">
            <div className="holdings-panel__account-label">
              {label}
              {isFhsa && (
                <span className="holdings-panel__account-badge">
                  Short horizon
                </span>
              )}
            </div>
            <ul className="holdings-panel__list">
              {account.holdings.map((h) => {
                const pct = ((h.valueCad / totalValue) * 100).toFixed(0)
                const initials = h.ticker.slice(0, 2).toUpperCase()
                return (
                  <li
                    key={`${account.id}-${h.ticker}`}
                    className="holdings-panel__item"
                    onClick={() => onHoldingClick?.(h.ticker)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onHoldingClick?.(h.ticker)
                    }}
                  >
                    <span
                      className="holdings-panel__icon"
                      style={{ backgroundColor: tickerColor(h.ticker) }}
                    >
                      {initials}
                    </span>
                    <span className="holdings-panel__name">{h.name}</span>
                    <span className="holdings-panel__value">${h.valueCad.toLocaleString()}</span>
                    <span className="holdings-panel__pct">{pct}%</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
