import { useEffect, useRef, useState } from 'react'
import type { Candidate, Portfolio, Signal } from '@prism/shared'
import { useAppContext } from '../../contexts/AppContext'
import { SessionList } from '../panels/SessionList'
import { HoldingsPanel } from '../panels/HoldingsPanel'
import { SignalsPanel } from '../panels/SignalsPanel'
import type { SessionSummary } from '../../hooks/useSessions'
import '../../styles/sidebar.css'

type SidebarTab = 'sessions' | 'holdings' | 'signals'

interface SidebarProps {
  readonly sessions: readonly SessionSummary[]
  readonly activeSessionId: string | null
  readonly onSelectSession: (id: string) => void
  readonly onCreateSession: (params: {
    type: SessionSummary['type']
    title: string
    signalId?: string
  }) => Promise<string>
  readonly onDeleteSession: (id: string) => Promise<void>
  readonly portfolio: Portfolio | null
  readonly portfolioLoading: boolean
  readonly signals: readonly Signal[]
  readonly signalsLoading: boolean
  readonly onSignalAnalyze: (signal: Signal) => void
  readonly onHoldingClick: (ticker: string) => void
  readonly candidates?: readonly Candidate[]
  readonly onCandidateAction?: (id: string, action: 'explore' | 'dismiss') => void
  readonly onPreviewPlan?: () => void
  readonly onCollapse: () => void
  readonly onHomeClick: () => void
  readonly onSearchOpen: () => void
  readonly activeTab: SidebarTab
  readonly onTabChange: (tab: SidebarTab) => void
  readonly userName?: string
  readonly userInitials?: string
}

const TABS: readonly { id: SidebarTab; label: string }[] = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'holdings', label: 'Holdings' },
  { id: 'signals', label: 'Signals' },
]

// Thin-line SVG icons (Wealthsimple style: 1.5px stroke, no fill)
const NavIcons = {
  newChat: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  chevron: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  collapse: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="11 17 6 12 11 7" />
      <line x1="18" y1="12" x2="6" y2="12" />
    </svg>
  ),
} as const

function ProfileSwitcher({
  userName,
  userInitials,
}: {
  readonly userName?: string
  readonly userInitials?: string
}) {
  const { userId, profiles, setUserId, loadProfiles } = useAppContext()
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) loadProfiles()
  }, [isOpen, loadProfiles])

  useEffect(() => {
    if (!isOpen) return

    function handleDocumentClick(event: MouseEvent) {
      if (!popoverRef.current) return
      if (!popoverRef.current.contains(event.target as Node)) setIsOpen(false)
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [isOpen])

  if (!userName) return null

  return (
    <div className="sidebar__profile-wrap" ref={popoverRef}>
      <button
        type="button"
        className="sidebar__profile"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <div className="sidebar__profile-avatar">{userInitials ?? userName.charAt(0)}</div>
        <span className="sidebar__profile-name">{userName}</span>
        <span className={`sidebar__profile-chevron ${isOpen ? 'sidebar__profile-chevron--open' : ''}`}>
          {NavIcons.chevron}
        </span>
      </button>

      {isOpen && (
        <div className="sidebar__profile-popover" role="dialog" aria-label="Switch profile">
          <div className="sidebar__popover-label">Switch profile</div>
          {profiles.map((profile) => {
            const isActive = profile.id === userId
            const initials = profile.name
              .split(' ')
              .map((part) => part.charAt(0))
              .join('')
              .toUpperCase()
              .slice(0, 2)

            return (
              <button
                key={profile.id}
                type="button"
                className={`sidebar__popover-item ${isActive ? 'sidebar__popover-item--active' : ''}`}
                onClick={() => {
                  setUserId(profile.id)
                  setIsOpen(false)
                }}
              >
                <span className="sidebar__popover-item-avatar">{initials}</span>
                <span className="sidebar__popover-item-info">
                  <span className="sidebar__popover-item-name">{profile.name}</span>
                  <span className="sidebar__popover-item-context">{profile.shortContext ?? profile.context}</span>
                </span>
                {isActive && <span className="sidebar__popover-check" aria-label="Active">&#10003;</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  portfolio,
  portfolioLoading,
  signals,
  signalsLoading,
  onSignalAnalyze,
  onHoldingClick,
  candidates,
  onCandidateAction,
  onPreviewPlan,
  onCollapse,
  onHomeClick,
  onSearchOpen,
  activeTab,
  onTabChange,
  userName,
  userInitials,
}: SidebarProps) {
  const handleNewChat = () => {
    onTabChange('sessions')
    void onCreateSession({ type: 'general', title: 'New conversation' })
  }

  return (
    <aside className="sidebar" aria-label="Explorer panel">
      <div className="sidebar__header">
        <button type="button" className="sidebar__brand" onClick={onHomeClick} aria-label="Go to home screen">
          Prism
        </button>
        <button
          type="button"
          className="sidebar__collapse"
          onClick={onCollapse}
          aria-label="Collapse sidebar"
        >
          {NavIcons.collapse}
        </button>
      </div>

      <nav className="sidebar__nav">
        <button type="button" className="sidebar__nav-item" onClick={handleNewChat}>
          <span className="sidebar__nav-icon">{NavIcons.newChat}</span>
          <span>New session</span>
        </button>
        <button type="button" className="sidebar__nav-item" onClick={onSearchOpen}>
          <span className="sidebar__nav-icon">{NavIcons.search}</span>
          <span>Search</span>
        </button>
      </nav>

      <div className="sidebar__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`sidebar__tab ${activeTab === tab.id ? 'sidebar__tab--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sidebar__content">
        {activeTab === 'sessions' && (
          <>
            <div className="sidebar__section-label">Recents</div>
            <SessionList
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={onSelectSession}
              onCreate={onCreateSession}
              onDelete={onDeleteSession}
              showHeader={false}
            />
          </>
        )}

        {activeTab === 'holdings' && (
          <HoldingsPanel
            portfolio={portfolio}
            isLoading={portfolioLoading}
            onHoldingClick={onHoldingClick}
            candidates={candidates}
            onCandidateAction={onCandidateAction}
            onPreviewPlan={onPreviewPlan}
          />
        )}

        {activeTab === 'signals' && (
          <SignalsPanel
            signals={signals}
            loading={signalsLoading}
            onAnalyze={onSignalAnalyze}
          />
        )}
      </div>

      <ProfileSwitcher userName={userName} userInitials={userInitials} />
    </aside>
  )
}
