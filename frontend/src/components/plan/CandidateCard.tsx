import { useCallback } from 'react'
import type { StrategyCandidate } from '@prism/shared'
import { TickerIcon } from '../common/TickerIcon'

interface CandidateCardProps {
  readonly candidate: StrategyCandidate
  readonly isAdded: boolean
  readonly allocationPct: number
  readonly positionSuggestion?: {
    readonly targetCad: number
    readonly referencePriceCad: number | null
    readonly estimatedShares: number | null
    readonly estimatedTradeCad: number | null
    readonly residualCad: number | null
    readonly sourceLabel: string
  }
  readonly onAdd: (id: string) => void
  readonly onRemove: (id: string) => void
  readonly onAllocationChange: (id: string, pct: number) => void
}

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}k`
  return `$${abs.toFixed(0)}`
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  })
}

export function CandidateCard({
  candidate,
  isAdded,
  allocationPct,
  positionSuggestion,
  onAdd,
  onRemove,
  onAllocationChange,
}: CandidateCardProps) {
  const handleToggle = useCallback(() => {
    if (isAdded) {
      onRemove(candidate.id)
    } else {
      onAdd(candidate.id)
    }
  }, [candidate.id, isAdded, onAdd, onRemove])

  const handleAllocation = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseFloat(e.target.value)
      if (!isNaN(value) && value >= 0 && value <= 10) {
        onAllocationChange(candidate.id, value)
      }
    },
    [candidate.id, onAllocationChange],
  )

  return (
    <div className={`candidate-card ${isAdded ? 'candidate-card--added' : ''}`}>
      <div className="candidate-card__header">
        <div className="candidate-card__identity">
          <TickerIcon ticker={candidate.ticker} size={34} />
          <div className="candidate-card__identity-text">
            <span className="candidate-card__ticker">{candidate.ticker}</span>
            <span className="candidate-card__name">{candidate.name}</span>
          </div>
        </div>
        <button
          type="button"
          className={`candidate-card__toggle ${isAdded ? 'candidate-card__toggle--remove' : ''}`}
          onClick={handleToggle}
        >
          {isAdded ? 'Remove' : 'Add'}
        </button>
      </div>

      <p className="candidate-card__rationale">{candidate.rationale}</p>

      <div className="candidate-card__meta">
        <span className="candidate-card__meta-item">
          {(candidate.confidence * 100).toFixed(0)}% confidence
        </span>
        <span className="candidate-card__meta-item">
          Cost ~{formatDollar(candidate.estimatedTurnoverCostCad)}
        </span>
        <span className="candidate-card__meta-item">
          Offsets {formatDollar(candidate.expectedMitigationCad)}
        </span>
        <span className="candidate-card__meta-item">
          Diversification {candidate.diversificationScore.toFixed(2)}
        </span>
      </div>

      {positionSuggestion && (
        <div className="candidate-card__position">
          <div className="candidate-card__position-row">
            <span className="candidate-card__position-label">Target size</span>
            <span className="candidate-card__position-value">
              {formatCurrency(positionSuggestion.targetCad)}
            </span>
          </div>
          {candidate.type === 'cash' ? (
            <div className="candidate-card__position-note">
              Held as liquidity reserve.
            </div>
          ) : positionSuggestion.referencePriceCad && positionSuggestion.estimatedShares !== null ? (
            <div className="candidate-card__position-row">
              <span className="candidate-card__position-label">
                ~{positionSuggestion.estimatedShares} shares
              </span>
              <span className="candidate-card__position-subvalue">
                @ {formatCurrency(positionSuggestion.referencePriceCad)}
              </span>
            </div>
          ) : (
            <div className="candidate-card__position-note">
              Shares unavailable ({positionSuggestion.sourceLabel})
            </div>
          )}
        </div>
      )}

      {isAdded && (
        <div className="candidate-card__allocation">
          <label className="candidate-card__allocation-label">
            Allocation:
            <input
              type="number"
              className="candidate-card__allocation-input"
              value={allocationPct}
              onChange={handleAllocation}
              min={0}
              max={10}
              step={0.5}
            />
            <span>%</span>
          </label>
        </div>
      )}
    </div>
  )
}
