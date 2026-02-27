import { useState, type ReactNode } from 'react'

interface Tab {
  readonly id: string
  readonly label: string
  readonly content: ReactNode
}

interface DetailTabsProps {
  readonly tabs: ReadonlyArray<Tab>
}

export function DetailTabs({ tabs }: DetailTabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? '')

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0]

  return (
    <div className="detail-tabs">
      <div className="detail-tabs__bar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`detail-tabs__tab${tab.id === activeId ? ' detail-tabs__tab--active' : ''}`}
            onClick={() => setActiveId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab?.content}
    </div>
  )
}
