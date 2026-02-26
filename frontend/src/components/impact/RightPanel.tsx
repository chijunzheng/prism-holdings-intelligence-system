import type { ReactNode } from 'react'
import type { ImpactRightTab } from '../../routes/impact/types'

interface RightPanelProps {
  readonly activeTab: ImpactRightTab
  readonly onTabChange: (tab: ImpactRightTab) => void
  readonly detailsContent: ReactNode
  readonly chatContent: ReactNode
  readonly quickActionsContent: ReactNode
  readonly className?: string
}

const TABS: ReadonlyArray<{ value: ImpactRightTab; label: string }> = [
  { value: 'details', label: 'Details' },
  { value: 'chat', label: 'Prism' },
  { value: 'quickActions', label: 'Quick Actions' },
]

export function RightPanel({
  activeTab,
  onTabChange,
  detailsContent,
  chatContent,
  quickActionsContent,
  className = '',
}: RightPanelProps) {
  const contentMap: Record<ImpactRightTab, ReactNode> = {
    details: detailsContent,
    chat: chatContent,
    quickActions: quickActionsContent,
  }

  return (
    <aside className={`impact-right ${className}`}>
      <div className="impact-right__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`impact-right__tab ${activeTab === tab.value ? 'is-active' : ''}`}
            onClick={() => onTabChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="impact-right__content">{contentMap[activeTab]}</div>
    </aside>
  )
}
