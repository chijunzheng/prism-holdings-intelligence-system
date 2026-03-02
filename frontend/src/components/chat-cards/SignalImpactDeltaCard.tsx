import type { SignalImpactDeltaData } from './types'
import type { ActionCenterMode } from './types'

interface SignalImpactDeltaCardProps {
  readonly data: SignalImpactDeltaData
  readonly onFollowUp?: (query: string) => void
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

function formatCad(value: number): string {
  const rounded = Math.round(value)
  const prefix = rounded > 0 ? '+' : ''
  return `${prefix}$${rounded.toLocaleString()}`
}

export function SignalImpactDeltaCard({ data, onFollowUp, onActionCenterMode }: SignalImpactDeltaCardProps) {
  function handleHoldingClick(holding: SignalImpactDeltaData['affectedHoldings'][number]) {
    if (onActionCenterMode) {
      onActionCenterMode({ mode: 'holding_detail', ticker: holding.ticker, holdingData: holding })
    }
    onFollowUp?.(`How exactly does this affect my ${holding.ticker}?`)
  }

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
          <div
            key={holding.ticker}
            className="chat-card__impact-row chat-card__impact-row--clickable"
            role="button"
            tabIndex={0}
            onClick={() => handleHoldingClick(holding)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleHoldingClick(holding) }}
          >
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
