import type { StrategyCandidate } from '../../types/graph'

interface CandidateRailProps {
  readonly candidates: ReadonlyArray<StrategyCandidate>
  readonly onAddCandidate: (candidate: StrategyCandidate) => void
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatCad(value: number): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString('en-CA')}`
}

export function CandidateRail({ candidates, onAddCandidate }: CandidateRailProps) {
  return (
    <section className="strategy-rail" aria-label="Recommended candidates">
      <header className="strategy-rail__header">
        <h3>Candidates</h3>
        <p>Drag into canvas or add directly.</p>
      </header>

      <ul className="strategy-rail__list">
        {candidates.length === 0 && (
          <li className="strategy-rail__empty">
            Build a draft to load candidate securities.
          </li>
        )}
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className="strategy-rail__card"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('application/prism-strategy-candidate', candidate.id)
              event.dataTransfer.effectAllowed = 'copy'
            }}
          >
            <div className="strategy-rail__row">
              <span className="strategy-rail__ticker">{candidate.ticker}</span>
              <span className="strategy-rail__type">{candidate.type}</span>
            </div>
            <p className="strategy-rail__name">{candidate.name}</p>
            <p className="strategy-rail__rationale">{candidate.rationale}</p>
            <p className="strategy-rail__meta">
              Confidence {(candidate.confidence * 100).toFixed(0)}% · Target shift {formatPct(candidate.proposedShiftPct)} · Effect {formatCad(candidate.expectedMitigationCad)}
            </p>
            <button
              type="button"
              className="strategy-rail__add-btn"
              onClick={() => onAddCandidate(candidate)}
            >
              Add To Scenario
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
