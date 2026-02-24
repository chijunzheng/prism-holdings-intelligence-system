import type { Overlap } from '@prism/shared'

interface OverlapListProps {
  readonly overlaps: ReadonlyArray<Overlap>
}

export function OverlapList({ overlaps }: OverlapListProps) {
  if (overlaps.length === 0) return null

  return (
    <div className="overlap-list">
      <h3 className="section-subtitle">Overlapping Holdings</h3>
      <p className="overlap-list__description">
        These assets appear in multiple ETFs, compounding your exposure:
      </p>
      <ul className="overlap-list__items">
        {overlaps.map((o) => (
          <li key={o.assetTicker ?? o.assetName} className="overlap-item">
            <span className="overlap-item__name">
              {o.assetName}
              {o.assetTicker ? ` (${o.assetTicker})` : ''}
            </span>
            <span className="overlap-item__total">{o.totalPercentage}% total</span>
            <span className="overlap-item__sources">
              via {o.sources.map((s) => s.fundTicker).join(' + ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
