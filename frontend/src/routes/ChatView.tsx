// ChatView — single-page chat interface replacing multi-page routes.
// Left panel: holdings, sessions, expectations
// Main area: chat message stream with rich cards + input

import { useState } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { usePortfolio } from '../hooks/usePortfolio'
import { useSessions } from '../hooks/useSessions'
import { HoldingsPanel } from '../components/panels/HoldingsPanel'
import { SessionList } from '../components/panels/SessionList'
import { ExpectationsPanel } from '../components/panels/ExpectationsPanel'
import { ChatArea } from '../components/panels/ChatArea'
import '../styles/chat-view.css'

export function ChatView() {
  const { userId } = useAppContext()
  const { portfolio, loading: portfolioLoading } = usePortfolio(userId)
  const {
    sessions,
    activeSessionId,
    createSession,
    selectSession,
    deleteSession,
  } = useSessions(userId)

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)

  return (
    <div className="chat-view">
      <aside className={`chat-view__left-panel ${leftPanelCollapsed ? 'chat-view__left-panel--collapsed' : ''}`}>
        <button
          className="chat-view__collapse-btn"
          onClick={() => setLeftPanelCollapsed((prev) => !prev)}
          aria-label={leftPanelCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {leftPanelCollapsed ? '\u203A' : '\u2039'}
        </button>

        {!leftPanelCollapsed && (
          <>
            <HoldingsPanel
              portfolio={portfolio}
              isLoading={portfolioLoading}
            />
            <div className="chat-view__divider" />
            <SessionList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={selectSession}
              onCreate={createSession}
              onDelete={deleteSession}
            />
            <div className="chat-view__divider" />
            <ExpectationsPanel userId={userId} />
          </>
        )}
      </aside>

      <main className="chat-view__main">
        <ChatArea
          userId={userId}
          activeSessionId={activeSessionId}
        />
      </main>
    </div>
  )
}
