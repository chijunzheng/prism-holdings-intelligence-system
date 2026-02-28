import type { SignalImpactDeltaData } from './types'

interface SignalImpactDeltaCardProps {
  readonly data: SignalImpactDeltaData
}

function formatCad(value: number): string {
  const rounded = Math.round(value)
  const prefix = rounded > 0 ? '+' : ''
  return `${prefix}$${rounded.toLocaleString()}`
}

export function SignalImpactDeltaCard({ data }: SignalImpactDeltaCardProps) {
  return (
    <div className="chat-card chat-card--impact-delta">
      <div className="chat-card__impact-header">
        <h4 className="chat-card__title">Portfolio Impact Now</h4>
        <span className={`chat-card__impact-badge ${data.netImpactMidCad < 0 ? 'chat-card__impact-badge--negative' : 'chat-card__impact-badge--positive'}`}>
          {formatCad(data.netImpactMidCad)}
        </span>
      </div>
      <p className="chat-card__description">{data.summary}</p>
      <div className="chat-card__impact-list">
        {data.affectedHoldings.map((holding) => (
          <div key={holding.ticker} className="chat-card__impact-row">
            <div className="chat-card__impact-holding">
              <span className="chat-card__impact-ticker">{holding.ticker}</span>
              <span className="chat-card__impact-name">{holding.name}</span>
            </div>
            <div className="chat-card__impact-values">
              <span className={holding.impactMidCad < 0 ? 'chat-card__impact-value--negative' : 'chat-card__impact-value--positive'}>
                {formatCad(holding.impactMidCad)}
              </span>
              <span className="chat-card__impact-confidence">{Math.round(holding.confidence * 100)}% conf.</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
