import { useNavigate } from 'react-router-dom'
import { useAppContext } from '../../contexts/AppContext'
import type { Overlap } from '@prism/shared'

interface OverlapListProps {
  readonly overlaps: ReadonlyArray<Overlap>
}

export function OverlapList({ overlaps }: OverlapListProps) {
  const { setActiveSidebarContext } = useAppContext()
  const navigate = useNavigate()

  if (overlaps.length === 0) return null

  function handleClick(o: Overlap) {
    const sources = o.sources.map((s) => s.fundTicker).join(' + ')
    setActiveSidebarContext({
      type: 'overlap',
      label: o.assetName,
      detail: `via ${sources}`,
    })
    navigate('/ask')
  }

  return (
    <div className="overlap-list">
      <p className="overlap-list__description">
        Assets appearing in multiple ETFs:
      </p>
      <ul className="overlap-list__items">
        {overlaps.map((o) => (
          <li key={o.assetTicker ?? o.assetName} className="overlap-item sidebar-clickable" onClick={() => handleClick(o)}>
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
            <span className="sidebar-clickable__chevron">›</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
