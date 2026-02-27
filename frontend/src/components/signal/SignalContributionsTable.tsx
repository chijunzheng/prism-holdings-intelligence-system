import type { PortfolioNetSignalContribution } from '../../types/graph'

interface SignalContributionsTableProps {
  readonly contributions: ReadonlyArray<PortfolioNetSignalContribution>
  readonly onSelectSignal: (signalId: string) => void
}

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : '+'
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

export function SignalContributionsTable({ contributions, onSelectSignal }: SignalContributionsTableProps) {
  const sorted = [...contributions].sort(
    (a, b) => Math.abs(b.oneMonthImpactCad) - Math.abs(a.oneMonthImpactCad),
  )

  return (
    <table className="contributions-table">
      <thead>
        <tr>
          <th>Signal</th>
          <th>Weight</th>
          <th>1M Impact</th>
          <th>Direction</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((c) => (
          <tr key={c.signalId}>
            <td>
              <button
                type="button"
                className="contributions-table__headline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                onClick={() => onSelectSignal(c.signalId)}
              >
                {c.headline}
              </button>
            </td>
            <td>
              <span className="contributions-table__weight-bar">
                <span
                  className="contributions-table__weight-fill"
                  style={{ width: `${Math.round(c.normalizedWeight * 100)}%` }}
                />
              </span>
              {Math.round(c.normalizedWeight * 100)}%
            </td>
            <td>
              <span className={c.oneMonthImpactCad < 0 ? 'affected-holdings__impact--negative' : 'affected-holdings__impact--positive'}>
                {formatDollar(c.oneMonthImpactCad)}
              </span>
            </td>
            <td style={{ textTransform: 'capitalize' }}>{c.direction}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
