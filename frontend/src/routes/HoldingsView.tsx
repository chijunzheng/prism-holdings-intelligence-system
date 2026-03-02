import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppContext } from '../contexts/AppContext'
import { usePortfolio } from '../hooks/usePortfolio'
import '../styles/explorer-pages.css'

type HoldingRow = {
  readonly accountLabel: string
  readonly ticker: string
  readonly name: string
  readonly valueCad: number
  readonly allocationPct: number
}

const ACCOUNT_LABELS: Record<string, string> = {
  TFSA: 'TFSA',
  RRSP: 'RRSP',
  FHSA: 'FHSA',
  LIRA: 'LIRA',
  NON_REGISTERED: 'Non-Registered',
}

export function HoldingsView() {
  const { userId } = useAppContext()
  const { portfolio, loading, error } = usePortfolio(userId)
  const [query, setQuery] = useState('')

  const rows = useMemo<readonly HoldingRow[]>(() => {
    if (!portfolio) return []
    const total = portfolio.totalValueCad || 1
    return portfolio.accounts
      .flatMap((account) => account.holdings.map((holding) => ({
        accountLabel: ACCOUNT_LABELS[account.type] ?? account.type,
        ticker: holding.ticker,
        name: holding.name,
        valueCad: holding.valueCad,
        allocationPct: (holding.valueCad / total) * 100,
      })))
      .sort((a, b) => b.valueCad - a.valueCad)
  }, [portfolio])

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((row) =>
      row.ticker.toLowerCase().includes(normalized) ||
      row.name.toLowerCase().includes(normalized) ||
      row.accountLabel.toLowerCase().includes(normalized),
    )
  }, [rows, query])

  return (
    <div className="explorer-page">
      <header className="explorer-page__header">
        <div>
          <p className="explorer-page__eyebrow">Portfolio Explorer</p>
          <h1>Holdings</h1>
          <p className="explorer-page__subtitle">
            Explore positions by account and jump directly into contextual analysis.
          </p>
        </div>
        <div className="explorer-page__summary-card">
          <span>Total Value</span>
          <strong>{portfolio ? `$${portfolio.totalValueCad.toLocaleString()}` : '--'}</strong>
          <small>{portfolio ? `${rows.length} holdings` : 'Waiting for portfolio data'}</small>
        </div>
      </header>

      <section className="explorer-page__panel">
        <div className="explorer-page__panel-header">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search ticker, holding, or account"
            className="explorer-page__search"
          />
        </div>

        {loading && <p className="explorer-page__empty">Loading holdings...</p>}
        {error && <p className="explorer-page__error">{error}</p>}
        {!loading && !error && filteredRows.length === 0 && (
          <p className="explorer-page__empty">No holdings match this search.</p>
        )}

        {!loading && !error && filteredRows.length > 0 && (
          <div className="holdings-table" role="table" aria-label="Holdings table">
            <div className="holdings-table__head" role="rowgroup">
              <span>Holding</span>
              <span>Account</span>
              <span>Value</span>
              <span>Allocation</span>
              <span>Action</span>
            </div>
            <div role="rowgroup">
              {filteredRows.map((row) => (
                <article key={`${row.accountLabel}-${row.ticker}`} className="holdings-table__row" role="row">
                  <div>
                    <strong>{row.ticker}</strong>
                    <p>{row.name}</p>
                  </div>
                  <span>{row.accountLabel}</span>
                  <span>${Math.round(row.valueCad).toLocaleString()}</span>
                  <span>{row.allocationPct.toFixed(1)}%</span>
                  <Link className="explorer-page__inline-link" to={`/?askHolding=${encodeURIComponent(row.ticker)}`}>
                    Ask Prism
                  </Link>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
