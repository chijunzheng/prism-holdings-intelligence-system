import type { Portfolio, AccountType } from '@prism/shared'

interface HoldingsListProps {
  readonly portfolio: Portfolio
  readonly selectedAccount: AccountType | 'ALL'
}

export function HoldingsList({ portfolio, selectedAccount }: HoldingsListProps) {
  const accounts =
    selectedAccount === 'ALL'
      ? portfolio.accounts
      : portfolio.accounts.filter((a) => a.type === selectedAccount)

  const holdings = accounts.flatMap((account) =>
    account.holdings.map((h) => ({ ...h, accountId: account.id, accountType: account.type })),
  )

  return (
    <div className="holdings-list">
      <h2 className="section-title">Holdings</h2>
      <table className="holdings-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Name</th>
            <th>Account</th>
            <th className="text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={`${h.accountType}-${h.ticker}`}>
              <td className="holdings-table__ticker">{h.ticker}</td>
              <td className="holdings-table__name">{h.name}</td>
              <td className="holdings-table__account">{h.accountType}</td>
              <td className="holdings-table__value text-right">
                ${h.valueCad.toLocaleString('en-CA')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
