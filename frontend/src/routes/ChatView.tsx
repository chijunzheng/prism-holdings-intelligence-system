import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Signal } from '@prism/shared'
import { useAppContext } from '../contexts/AppContext'
import { useSessions } from '../hooks/useSessions'
import { usePortfolio } from '../hooks/usePortfolio'
import { useSignals } from '../hooks/useSignals'
import { useCandidates } from '../hooks/useCandidates'
import { ActionCenter } from '../components/panels/ActionCenter'
import { ChatArea } from '../components/panels/ChatArea'
import { Sidebar } from '../components/layout/Sidebar'
import { SearchModal } from '../components/layout/SearchModal'
import type { ActionCenterMode } from '../components/chat-cards/types'
import '../styles/chat-view.css'

function updateSearchParam(
  current: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  key: string,
  value: string | null,
) {
  const next = new URLSearchParams(current)
  if (value === null) next.delete(key)
  else next.set(key, value)
  setSearchParams(next, { replace: true })
}

// ── Action Center reducer ──────────────────────────

type ActionCenterAction =
  | { type: 'SET_MODE'; mode: ActionCenterMode }
  | { type: 'RESET' }

function actionCenterReducer(_state: ActionCenterMode, action: ActionCenterAction): ActionCenterMode {
  switch (action.type) {
    case 'SET_MODE':
      return action.mode
    case 'RESET':
      return { mode: 'idle' }
  }
}

export function ChatView() {
  const { userId, profiles, loadProfiles } = useAppContext()
  const { portfolio, loading: portfolioLoading } = usePortfolio(userId)
  const { signals, loading: signalsLoading } = useSignals(userId)
  const {
    sessions,
    activeSessionId,
    createSession,
    updateSession,
    selectSession,
    deleteSession,
  } = useSessions(userId)

  const {
    candidates,
    updateCandidate,
    saveFromRecommendation,
    previewPlan,
  } = useCandidates(userId)

  const [searchParams, setSearchParams] = useSearchParams()
  const [isActionCenterOpen, setIsActionCenterOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Single reducer for Action Center mode (replaces impactDelta, playbook, reasoningTrace)
  const [actionCenterMode, dispatchActionCenter] = useReducer(
    actionCenterReducer,
    { mode: 'idle' } as ActionCenterMode,
  )

  const isSidebarCollapsed = searchParams.get('sidebar') === 'collapsed'
  const rawPanel = searchParams.get('panel')
  const activeTab = rawPanel === 'holdings' || rawPanel === 'signals' || rawPanel === 'sessions'
    ? rawPanel
    : 'sessions'

  // Derive user name from profiles
  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  const userName = useMemo(() => {
    const profile = profiles.find((p) => p.id === userId)
    return profile?.name
  }, [profiles, userId])

  const userInitials = useMemo(() => {
    if (!userName) return undefined
    return userName
      .split(' ')
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }, [userName])

  const chatSendRef = useRef<((msg: string) => void) | null>(null)
  const analyzeSignalRef = useRef<((signal: Signal) => void) | null>(null)

  const handleSignalAnalyze = useCallback((signal: Signal) => {
    setIsActionCenterOpen(true)
    dispatchActionCenter({ type: 'RESET' })
    analyzeSignalRef.current?.(signal)
  }, [])

  const handleHoldingClick = useCallback((ticker: string) => {
    chatSendRef.current?.(`Tell me about my ${ticker} holding and how current market events affect it`)
  }, [])

  const handleSavePlan = useCallback(
    (recommendationId: string, recommendations: readonly import('@prism/shared').Recommendation[]) => {
      const rec = recommendations.find((r) => r.id === recommendationId)
      if (!rec?.actions || rec.actions.length === 0) return
      void saveFromRecommendation({
        recommendationId,
        sourceLabel: rec.title,
        actions: rec.actions,
      })
    },
    [saveFromRecommendation],
  )

  const handleCandidateAction = useCallback((id: string, action: 'explore' | 'dismiss') => {
    if (action === 'dismiss') {
      updateCandidate(id, 'dismissed')
      return
    }
    // Explore: find the candidate and send a what-if message
    const candidate = candidates.find((c) => c.id === id)
    if (candidate) {
      const verb = candidate.action === 'add_new' ? 'add' : candidate.action
      const amount = candidate.suggestedChangeCad
        ? ` by ~$${Math.abs(candidate.suggestedChangeCad).toLocaleString()}`
        : ''
      chatSendRef.current?.(
        `What would happen if I ${verb} my ${candidate.ticker} position${amount}? How does this change my portfolio risk?`,
      )
    }
  }, [candidates, updateCandidate])

  const handlePreviewPlan = useCallback(async () => {
    const preview = await previewPlan()
    if (preview) {
      // Send a system message with the plan preview card
      chatSendRef.current?.('Preview my planned portfolio changes')
    }
  }, [previewPlan])

  const toggleSidebar = useCallback(() => {
    updateSearchParam(searchParams, setSearchParams, 'sidebar', isSidebarCollapsed ? null : 'collapsed')
  }, [isSidebarCollapsed, searchParams, setSearchParams])

  const handleTabChange = useCallback((tab: 'sessions' | 'holdings' | 'signals') => {
    updateSearchParam(searchParams, setSearchParams, 'panel', tab)
  }, [searchParams, setSearchParams])

  const handleSearchSelect = useCallback((sessionId: string) => {
    selectSession(sessionId)
  }, [selectSession])

  // Mode change handler — auto-opens Action Center
  const handleActionCenterMode = useCallback((mode: ActionCenterMode) => {
    dispatchActionCenter({ type: 'SET_MODE', mode })
    setIsActionCenterOpen(true)
  }, [])

  const handleActionCenterClose = useCallback(() => {
    dispatchActionCenter({ type: 'RESET' })
  }, [])

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Reset Action Center mode on session change
  useEffect(() => {
    dispatchActionCenter({ type: 'RESET' })
  }, [activeSessionId, userId])

  useEffect(() => {
    const askHoldingTicker = searchParams.get('askHolding')
    if (!askHoldingTicker) return

    let attempts = 0
    const timer = window.setInterval(() => {
      if (!chatSendRef.current) {
        attempts += 1
        if (attempts > 40) window.clearInterval(timer)
        return
      }

      chatSendRef.current(
        `Tell me about my ${askHoldingTicker} holding and how current market events affect it`,
      )
      updateSearchParam(searchParams, setSearchParams, 'askHolding', null)
      window.clearInterval(timer)
    }, 40)

    return () => {
      window.clearInterval(timer)
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    const shouldCreate = searchParams.get('newSession')
    if (shouldCreate !== '1') return

    void createSession({ type: 'general', title: 'New conversation' }).finally(() => {
      updateSearchParam(searchParams, setSearchParams, 'newSession', null)
    })
  }, [createSession, searchParams, setSearchParams])

  useEffect(() => {
    const analyzeSignalId = searchParams.get('analyzeSignal')
    if (!analyzeSignalId) return

    const signal = signals.find((entry) => entry.id === analyzeSignalId)
    if (!signal) return

    let attempts = 0
    const timer = window.setInterval(() => {
      if (!analyzeSignalRef.current) {
        attempts += 1
        if (attempts > 40) window.clearInterval(timer)
        return
      }

      setIsActionCenterOpen(true)
      analyzeSignalRef.current(signal)
      updateSearchParam(searchParams, setSearchParams, 'analyzeSignal', null)
      window.clearInterval(timer)
    }, 40)

    return () => {
      window.clearInterval(timer)
    }
  }, [searchParams, setSearchParams, signals])

  return (
    <div className="home-view">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={selectSession}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
        portfolio={portfolio}
        portfolioLoading={portfolioLoading}
        signals={signals}
        signalsLoading={signalsLoading}
        onSignalAnalyze={handleSignalAnalyze}
        onHoldingClick={handleHoldingClick}
        candidates={candidates}
        onCandidateAction={handleCandidateAction}
        onPreviewPlan={handlePreviewPlan}
        onCollapse={toggleSidebar}
        onHomeClick={() => selectSession(null)}
        onSearchOpen={() => setIsSearchOpen(true)}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        userName={userName}
        userInitials={userInitials}
      />

      <main className="home-view__main">
        <div className="home-view__toolbar">
          <button
            type="button"
            className="home-view__toolbar-btn"
            onClick={() => setIsActionCenterOpen((prev) => !prev)}
            aria-label={isActionCenterOpen ? 'Hide details panel' : 'Show details panel'}
          >
            {isActionCenterOpen ? 'Hide Details' : 'Show Details'}
          </button>
        </div>

        <div className={`home-view__workspace ${isActionCenterOpen ? 'home-view__workspace--action-open' : ''}`}>
          <section className="home-view__story">
            <ChatArea
              userId={userId}
              activeSessionId={activeSessionId}
              signals={signals}
              userName={userName}
              onSendRef={chatSendRef}
              onAnalyzeSignalRef={analyzeSignalRef}
              onCreateSession={createSession}
              onUpdateSession={updateSession}
              onSavePlan={handleSavePlan}
              onActionCenterMode={handleActionCenterMode}
            />
          </section>

          {isActionCenterOpen && (
            <section className="home-view__action">
              <ActionCenter
                mode={actionCenterMode}
                onClose={handleActionCenterClose}
              />
            </section>
          )}
        </div>
      </main>

      {isSearchOpen && (
        <SearchModal
          sessions={sessions}
          onSelect={handleSearchSelect}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
    </div>
  )
}
