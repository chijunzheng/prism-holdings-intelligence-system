import type { Portfolio } from '@prism/shared'

interface HoldingsListProps {
  readonly portfolio: Portfolio
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatUnits(units: number): string {
  return units % 1 === 0
    ? `${units.toLocaleString()} shares`
    : `${units.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} units`
}

export function HoldingsList({ portfolio }: HoldingsListProps) {
  const holdings = portfolio.accounts.flatMap((account) =>
    account.holdings.map((h) => ({
      ...h,
      accountId: account.id,
      accountType: account.type,
    })),
  )

  const sorted = [...holdings].sort((a, b) => b.valueCad - a.valueCad)

  return (
    <div className="holdings-section">
      <div className="section-header">
        <h2 className="section-title">Holdings</h2>
      </div>

      <div className="holdings-card">
        <table className="holdings-table">
          <thead>
            <tr>
              <th>Positions</th>
              <th className="text-right">Total value</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={`${h.accountType}-${h.ticker}`} className="holdings-row">
                <td className="holdings-row__position-cell">
                  <div className="holdings-row__position-name">{h.ticker}</div>
                  <div className="holdings-row__position-sub">
                    {h.name} · {h.accountType.replace('_', ' ')}
                  </div>
                </td>
                <td className="holdings-row__value">
                  <div className="holdings-row__value-amount">{formatCurrency(h.valueCad)} CAD</div>
                  <div className="holdings-row__value-shares">{formatUnits(h.units)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
