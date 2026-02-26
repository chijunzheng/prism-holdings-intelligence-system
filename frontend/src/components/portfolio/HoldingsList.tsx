import type { Holding, Portfolio } from '@prism/shared'
import { TickerIcon } from '../common/TickerIcon'

export type FlattenedHolding = Holding & {
  readonly accountId: string
}

interface HoldingsListProps {
  readonly portfolio: Portfolio
  readonly selectedTicker?: string | null
  readonly onSelect?: (holding: FlattenedHolding) => void
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatUnits(units: number): string {
  return units % 1 === 0
    ? `${units.toLocaleString()} shares`
    : `${units.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} units`
}

export function flattenHoldings(portfolio: Portfolio): ReadonlyArray<FlattenedHolding> {
  return portfolio.accounts.flatMap((account) =>
    account.holdings.map((h) => ({
      ...h,
      accountId: account.id,
    })),
  )
}

export function HoldingsList({ portfolio, selectedTicker, onSelect }: HoldingsListProps) {
  const holdings = flattenHoldings(portfolio)
  const sorted = [...holdings].sort((a, b) => b.valueCad - a.valueCad)

  return (
    <div className="holdings-section">
      <div className="holdings-card">
        <table className="holdings-table">
          <thead>
            <tr>
              <th>Positions</th>
              <th className="text-right">Total value</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => {
              const key = `${h.accountType}-${h.ticker}`
              const isSelected = selectedTicker === h.ticker
              const rowClass = [
                'holdings-row',
                onSelect ? 'holdings-row--clickable' : '',
                isSelected ? 'holdings-row--selected' : '',
              ].filter(Boolean).join(' ')

              return (
                <tr
                  key={key}
                  className={rowClass}
                  onClick={onSelect ? () => onSelect(h) : undefined}
                  onKeyDown={onSelect ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(h)
                    }
                  } : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  role={onSelect ? 'button' : undefined}
                  aria-selected={isSelected || undefined}
                >
                  <td className="holdings-row__position-cell">
                    <TickerIcon ticker={h.ticker} size={36} />
                    <div>
                      <div className="holdings-row__position-name">{h.ticker}</div>
                      <div className="holdings-row__position-sub">
                        {h.name} · {h.accountType.replace('_', ' ')}
                      </div>
                    </div>
                  </td>
                  <td className="holdings-row__value">
                    <div className="holdings-row__value-amount">{formatCurrency(h.valueCad)} CAD</div>
                    <div className="holdings-row__value-shares">{formatUnits(h.units)}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
