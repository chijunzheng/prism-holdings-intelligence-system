import type { ReactNode } from 'react'

type RightTab = 'details' | 'chat' | 'actions'

interface RightPanelProps {
  readonly activeTab: RightTab
  readonly onTabChange: (tab: RightTab) => void
  readonly detailsContent: ReactNode
  readonly chatContent: ReactNode
  readonly actionsContent: ReactNode
  readonly className?: string
}

const TABS: ReadonlyArray<{ value: RightTab; label: string }> = [
  { value: 'details', label: 'Details' },
  { value: 'chat', label: 'Chat' },
  { value: 'actions', label: 'Actions' },
]

export function RightPanel({
  activeTab,
  onTabChange,
  detailsContent,
  chatContent,
  actionsContent,
  className = '',
}: RightPanelProps) {
  const contentMap: Record<RightTab, ReactNode> = {
    details: detailsContent,
    chat: chatContent,
    actions: actionsContent,
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
      <div className="impact-right__content">
        {contentMap[activeTab]}
      </div>
    </aside>
  )
}
