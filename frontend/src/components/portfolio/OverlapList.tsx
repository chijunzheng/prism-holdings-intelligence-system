import type { Overlap } from '@prism/shared'

interface OverlapListProps {
  readonly overlaps: ReadonlyArray<Overlap>
}

export function OverlapList({ overlaps }: OverlapListProps) {
  if (overlaps.length === 0) return null

  return (
    <div className="overlap-list">
      <p className="overlap-list__description">
        Assets appearing in multiple ETFs:
      </p>
      <ul className="overlap-list__items">
        {overlaps.map((o) => (
          <li key={o.assetTicker ?? o.assetName} className="overlap-item">
            <div className="overlap-item__header">
              <span className="overlap-item__name">
                {o.assetName}
                {o.assetTicker ? ` (${o.assetTicker})` : ''}
              </span>
              <span className="overlap-item__total">{o.totalPercentage}%</span>
            </div>
            <span className="overlap-item__sources">
              via {o.sources.map((s) => s.fundTicker).join(' + ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
