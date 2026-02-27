import type { HealthScore } from '@prism/shared'

interface RiskRadarProps {
  readonly healthScore: HealthScore
  readonly onClick?: () => void
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#0da750', A: '#0da750', 'A-': '#0da750',
  'B+': '#22c55e', B: '#22c55e', 'B-': '#22c55e',
  'C+': '#ca8a04', C: '#ca8a04', 'C-': '#ca8a04',
  'D+': '#ea580c', D: '#ea580c', 'D-': '#ea580c',
  F: '#dc2626',
}

const DIMENSION_LABELS: Record<string, string> = {
  diversification: 'Diversification',
  concentration: 'Concentration',
  overlap: 'Overlap',
  freshness: 'Data Freshness',
}

function getBarColor(score: number): string {
  if (score >= 80) return '#0da750'
  if (score >= 60) return '#22c55e'
  if (score >= 40) return '#ca8a04'
  if (score >= 20) return '#ea580c'
  return '#dc2626'
}

export function RiskRadar({ healthScore, onClick }: RiskRadarProps) {
  const gradeColor = GRADE_COLORS[healthScore.grade] ?? '#737373'
  const dimensions = [
    healthScore.subScores.diversification,
    healthScore.subScores.concentration,
    healthScore.subScores.overlap,
    healthScore.subScores.freshness,
  ]

  return (
    <aside className="risk-radar">
      <h3 className="risk-radar__title">Risk Radar</h3>

      <div className="risk-radar__grade-container">
        <span
          className="risk-radar__grade"
          style={{ color: gradeColor }}
        >
          {healthScore.grade}
        </span>
        <span className="risk-radar__grade-label">Portfolio Health</span>
        <span className="risk-radar__composite">{healthScore.composite}/100</span>
      </div>

      <div className="risk-radar__dimensions">
        {dimensions.map((sub) => (
          <div key={sub.dimension} className="risk-radar__dimension">
            <div className="risk-radar__dimension-header">
              <span className="risk-radar__dimension-label">
                {DIMENSION_LABELS[sub.dimension]}
              </span>
              <span className="risk-radar__dimension-score">{sub.score}</span>
            </div>
            <div className="risk-radar__bar-track">
              <div
                className="risk-radar__bar-fill"
                style={{
                  width: `${sub.score}%`,
                  backgroundColor: getBarColor(sub.score),
                }}
              />
            </div>
            <p className="risk-radar__dimension-insight">{sub.insight}</p>
          </div>
        ))}
      </div>

      {onClick && (
        <div
          className="risk-radar__cta"
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
        >
          Discuss with Prism &rarr;
        </div>
      )}
    </aside>
  )
}
