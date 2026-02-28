// ChatView — single-page chat interface.
// Left panel: profile switcher, holdings, signals, sessions, expectations
// Main area: chat message stream with rich cards + floating input

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { usePortfolio } from '../hooks/usePortfolio'
import { useSessions } from '../hooks/useSessions'
import { useSignals } from '../hooks/useSignals'
import { HoldingsPanel } from '../components/panels/HoldingsPanel'
import { SignalsPanel } from '../components/panels/SignalsPanel'
import { SessionList } from '../components/panels/SessionList'
import { ExpectationsPanel } from '../components/panels/ExpectationsPanel'
import { ChatArea } from '../components/panels/ChatArea'
import type { Signal } from '@prism/shared'
import '../styles/chat-view.css'

function ProfileSwitcher() {
  const { userId, setUserId, profiles, loadProfiles } = useAppContext()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const activeProfile = profiles.find((p) => p.id === userId)
  const initials = activeProfile
    ? activeProfile.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : userId.slice(0, 2).toUpperCase()

  return (
    <div className="ws-profile" ref={ref}>
      <button
        className="ws-profile__trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Switch profile"
      >
        <span className="ws-profile__avatar">{initials}</span>
        <span className="ws-profile__trigger-name">{activeProfile?.name ?? userId}</span>
        <svg className={`ws-profile__chevron ${open ? 'ws-profile__chevron--open' : ''}`} width="12" height="12" viewBox="0 0 12 12">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {open && (
        <div className="ws-profile__dropdown">
          <div className="ws-profile__header">
            <span className="ws-profile__header-avatar">{initials}</span>
            <div className="ws-profile__header-info">
              <span className="ws-profile__header-name">{activeProfile?.name ?? userId}</span>
              <span className="ws-profile__header-context">{activeProfile?.context ?? 'Demo user'}</span>
            </div>
          </div>
          <div className="ws-profile__divider" />
          <div className="ws-profile__section-label">Switch profile</div>
          {profiles.map((p) => {
            const pInitials = p.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
            const isActive = p.id === userId
            return (
              <button
                key={p.id}
                className={`ws-profile__item ${isActive ? 'ws-profile__item--active' : ''}`}
                onClick={() => {
                  setUserId(p.id)
                  setOpen(false)
                }}
              >
                <span className="ws-profile__item-avatar">{pInitials}</span>
                <div className="ws-profile__item-info">
                  <span className="ws-profile__item-name">{p.name}</span>
                  <span className="ws-profile__item-context">{p.shortContext ?? p.riskTolerance}</span>
                </div>
                {isActive && (
                  <svg className="ws-profile__check" width="16" height="16" viewBox="0 0 16 16">
                    <path d="M3.5 8.5L6.5 11.5L12.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
  const { signals, loading: signalsLoading } = useSignals(userId)

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)

  // Ref to ChatArea's handleSend so holding clicks and signal clicks can trigger chat
  const chatSendRef = useRef<((msg: string) => void) | null>(null)
  const analyzeSignalRef = useRef<((signal: Signal) => void) | null>(null)

  const handleHoldingClick = useCallback((ticker: string) => {
    chatSendRef.current?.(`Tell me about my ${ticker} holding and how current market events affect it`)
  }, [])

  const handleSignalAnalyze = useCallback((signal: Signal) => {
    analyzeSignalRef.current?.(signal)
  }, [])

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
            <div className="chat-view__panel-top">
              <span className="chat-view__wordmark">Prism</span>
            </div>
            <div className="chat-view__divider" />
            <HoldingsPanel
              portfolio={portfolio}
              isLoading={portfolioLoading}
              onHoldingClick={handleHoldingClick}
            />
            <div className="chat-view__divider" />
            <SignalsPanel
              signals={signals}
              loading={signalsLoading}
              onAnalyze={handleSignalAnalyze}
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
            <div className="chat-view__panel-spacer" />
            <div className="chat-view__divider" />
            <div className="chat-view__panel-bottom">
              <ProfileSwitcher />
            </div>
          </>
        )}
      </aside>

      <main className="chat-view__main">
        <ChatArea
          userId={userId}
          activeSessionId={activeSessionId}
          signals={signals}
          onSendRef={chatSendRef}
          onAnalyzeSignalRef={analyzeSignalRef}
        />
      </main>
    </div>
  )
}
