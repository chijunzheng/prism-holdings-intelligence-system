import type { CausalChain, CausalChainEdge, CausalChainNode } from '@prism/shared'
import { TickerIcon } from '../common/TickerIcon'

interface AffectedHolding {
  readonly ticker: string
  readonly label: string
  readonly dollarImpact: number
  readonly confidence: number
  readonly mechanisms: ReadonlyArray<string>
}

interface AffectedHoldingsTableProps {
  readonly chain: CausalChain
}

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : '+'
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

function extractTicker(label: string): string {
  // Labels often look like "ZEB (BMO Canadian Bank ETF)" — extract the ticker
  const match = label.match(/^([A-Z]{2,5})\b/)
  return match ? match[1] : label.slice(0, 3).toUpperCase()
}

function extractAffectedHoldings(chain: CausalChain): ReadonlyArray<AffectedHolding> {
  const assetNodes = chain.nodes.filter((n) => n.type === 'asset')

  const edgesByTarget = new Map<string, ReadonlyArray<CausalChainEdge>>()
  for (const edge of chain.edges) {
    const existing = edgesByTarget.get(edge.target) ?? []
    edgesByTarget.set(edge.target, [...existing, edge])
  }

  const nodeMap = new Map<string, CausalChainNode>(
    chain.nodes.map((n) => [n.id, n]),
  )

  return assetNodes
    .map((node) => {
      const incomingEdges = edgesByTarget.get(node.id) ?? []
      const mechanisms = incomingEdges
        .map((e) => nodeMap.get(e.source)?.label)
        .filter((label): label is string => label !== undefined)

      return {
        ticker: node.label,
        label: node.description,
        dollarImpact: node.dollarImpact ?? 0,
        confidence: node.confidence,
        mechanisms,
      }
    })
    .sort((a, b) => Math.abs(b.dollarImpact) - Math.abs(a.dollarImpact))
}

export function AffectedHoldingsTable({ chain }: AffectedHoldingsTableProps) {
  const holdings = extractAffectedHoldings(chain)

  if (holdings.length === 0) return null

  return (
    <section className="affected-holdings">
      <h2 className="affected-holdings__title">Affected Holdings</h2>
      <table className="affected-holdings__table">
        <thead>
          <tr>
            <th>Holding</th>
            <th>Est. Impact</th>
            <th>Via</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const ticker = extractTicker(h.ticker)
            return (
              <tr key={h.ticker}>
                <td>
                  <div className="affected-holdings__holding-cell">
                    <TickerIcon ticker={ticker} size={32} />
                    <div>
                      <div className="affected-holdings__holding-name">{ticker}</div>
                      <div className="affected-holdings__holding-desc">{h.label}</div>
                    </div>
                  </div>
                </td>
                <td className={h.dollarImpact < 0 ? 'affected-holdings__impact--negative' : 'affected-holdings__impact--positive'}>
                  {formatDollar(h.dollarImpact)}
                </td>
                <td>
                  {h.mechanisms.slice(0, 2).map((m) => (
                    <span key={m} className="affected-holdings__mechanism">{m}</span>
                  ))}
                </td>
                <td className="affected-holdings__confidence">
                  {(h.confidence * 100).toFixed(0)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
