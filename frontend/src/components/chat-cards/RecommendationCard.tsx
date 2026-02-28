// RecommendationCard — presents 2-3 plan options with "do nothing" baseline.

import { useState } from 'react'
import type { Recommendation } from '@prism/shared'

interface RecommendationCardProps {
  readonly data: unknown
  readonly onSelect?: (id: string) => void
}

export function RecommendationCard({ data, onSelect }: RecommendationCardProps) {
  const recommendations = data as readonly Recommendation[]
  const [selectedId, setSelectedId] = useState<string | null>(null)

  function handleSelect(id: string) {
    setSelectedId(id)
    onSelect?.(id)
  }

  return (
    <div className="chat-card chat-card--recommendation">
      <h4 className="chat-card__title">Recommendations</h4>
      <div className="chat-card__options">
        {recommendations.map((rec) => (
          <button
            key={rec.id}
            className={`chat-card__option ${selectedId === rec.id ? 'chat-card__option--selected' : ''} ${rec.isDoNothing ? 'chat-card__option--baseline' : ''}`}
            onClick={() => handleSelect(rec.id)}
          >
            <div className="chat-card__option-header">
              <span className="chat-card__option-title">{rec.title}</span>
              {rec.isDoNothing && <span className="chat-card__baseline-tag">Baseline</span>}
            </div>
            <p className="chat-card__option-desc">{rec.description}</p>
            <div className="chat-card__option-meta">
              <span>Cost: {rec.estimatedCost}</span>
              <span>Reduction: {rec.riskReduction}</span>
            </div>
            <div className="chat-card__option-tradeoffs">
              {rec.tradeoffs.map((t, i) => (
                <span key={i} className="chat-card__tradeoff-chip">{t}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
