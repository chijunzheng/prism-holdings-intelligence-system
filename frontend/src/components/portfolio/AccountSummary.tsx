import type { Portfolio, AccountType } from '@prism/shared'

interface AccountSummaryProps {
  readonly portfolio: Portfolio
  readonly selectedAccount: AccountType | 'ALL'
  readonly onAccountChange: (account: AccountType | 'ALL') => void
}

export function AccountSummary({
  portfolio,
  selectedAccount,
  onAccountChange,
}: AccountSummaryProps) {
  const accountTypes = Array.from(new Set(portfolio.accounts.map((a) => a.type)))

  const displayValue =
    selectedAccount === 'ALL'
      ? portfolio.totalValueCad
      : portfolio.accounts
          .filter((a) => a.type === selectedAccount)
          .reduce((sum, a) => sum + a.holdings.reduce((s, h) => s + h.valueCad, 0), 0)

  return (
    <div className="account-summary">
      <div className="account-summary__value">
        <span className="account-summary__label">Total Portfolio Value</span>
        <span className="account-summary__amount">
          ${displayValue.toLocaleString('en-CA', { minimumFractionDigits: 0 })}
        </span>
      </div>
      <div className="account-summary__accounts">
        <button
          className={`account-pill ${selectedAccount === 'ALL' ? 'account-pill--active' : ''}`}
          onClick={() => onAccountChange('ALL')}
        >
          All Accounts
        </button>
        {accountTypes.map((type) => (
          <button
            key={type}
            className={`account-pill ${selectedAccount === type ? 'account-pill--active' : ''}`}
            onClick={() => onAccountChange(type)}
          >
            {type}
          </button>
        ))}
      </div>
    </div>
  )
}
