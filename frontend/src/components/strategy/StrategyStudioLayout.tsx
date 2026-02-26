import type { ReactNode } from 'react'

interface StrategyStudioLayoutProps {
  readonly left: ReactNode
  readonly center: ReactNode
  readonly right: ReactNode
}

export function StrategyStudioLayout({ left, center, right }: StrategyStudioLayoutProps) {
  return (
    <div className="strategy-layout">
      <div className="strategy-layout__left">{left}</div>
      <div className="strategy-layout__center">{center}</div>
      <div className="strategy-layout__right">{right}</div>
    </div>
  )
}
