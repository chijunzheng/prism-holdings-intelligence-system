import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../contexts/AppContext'
import type { SidebarContext } from '../contexts/AppContext'
import { useChat } from '../hooks/useChat'
import { useExposureData } from '../hooks/useExposureData'
import { ChatMessage } from '../components/chat/ChatMessage'
import { ChatInput } from '../components/chat/ChatInput'
import '../styles/insights.css'
import '../styles/chat.css'

const DEFAULT_PROMPTS = [
  'What sectors am I most exposed to?',
  'How diversified is my portfolio?',
  'What risks should I know about?',
  'How much overlap do my ETFs have?',
] as const

function getContextualPrompts(ticker: string): ReadonlyArray<string> {
  return [
    `What risks does ${ticker} face right now?`,
    `How does ${ticker} affect my portfolio diversification?`,
    `What sectors am I exposed to through ${ticker}?`,
    `Should I be concerned about my ${ticker} concentration?`,
  ]
}

function getSidebarContextPrompts(ctx: SidebarContext): ReadonlyArray<string> {
  switch (ctx.type) {
    case 'concentration':
      return [
        `My portfolio has ${ctx.detail}. What risks does this concentration pose?`,
        `Should I rebalance my ${ctx.label} exposure?`,
        `How would a downturn in ${ctx.label} affect my portfolio?`,
        `What alternatives could reduce my ${ctx.label} concentration?`,
      ]
    case 'overlap':
      return [
        `How does ${ctx.label} overlap across my ETFs affect my risk?`,
        `What happens to my portfolio if ${ctx.label} drops significantly?`,
        `Is my ${ctx.label} overlap a diversification concern?`,
        `Should I consolidate my ${ctx.label} exposure into fewer ETFs?`,
      ]
    case 'exposure':
      return [
        'What sectors am I most exposed to?',
        'How can I improve my portfolio diversification?',
        'Which exposure categories carry the most risk right now?',
        'Am I overweight in any particular sector or region?',
      ]
  }
}

function buildAutoSendMessage(ctx: SidebarContext): string {
  switch (ctx.type) {
    case 'concentration':
      return `My portfolio has ${ctx.detail}. What risks does this concentration pose and should I be concerned?`
    case 'overlap':
      return `I noticed ${ctx.label} overlap across my ETFs. How does this affect my risk and diversification?`
    case 'exposure':
      return `Can you analyze my portfolio exposure breakdown and highlight any concerns?`
  }
}

function getDividerLabel(ctx: SidebarContext): string {
  switch (ctx.type) {
    case 'concentration':
      return `New topic: ${ctx.label} concentration`
    case 'overlap':
      return `New topic: ${ctx.label} overlap`
    case 'exposure':
      return `New topic: Exposure analysis`
  }
}

export function InsightsView() {
  const { userId, activeHoldingContext, activeSidebarContext, setActiveSidebarContext } = useAppContext()
  const { messages, isLoading, error, sendMessage, addDivider, isInitialized } = useChat({
    userId,
    mode: 'general',
  })
  const { exposureMap } = useExposureData(userId)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sendMessageRef = useRef(sendMessage)
  const addDividerRef = useRef(addDivider)
  const autoSentRef = useRef(false)
  const [pendingSidebarContext, setPendingSidebarContext] = useState<SidebarContext | null>(null)
  const [showFollowUps, setShowFollowUps] = useState(false)
  const [userSentManual, setUserSentManual] = useState(false)
  // Track whether this is the very first sidebar click (no prior user messages)
  const hasExistingConversation = messages.length > 1

  // Keep refs current without triggering effects
  sendMessageRef.current = sendMessage
  addDividerRef.current = addDivider

  // Capture sidebar context on change, reset auto-send tracking
  useEffect(() => {
    if (activeSidebarContext) {
      setPendingSidebarContext(activeSidebarContext)
      autoSentRef.current = false
      setShowFollowUps(false)
      setUserSentManual(false)
    }
  }, [activeSidebarContext])

  // Auto-send when chat is ready (initialized and not loading)
  useEffect(() => {
    if (pendingSidebarContext && isInitialized && !isLoading && !autoSentRef.current) {
      autoSentRef.current = true
      const message = buildAutoSendMessage(pendingSidebarContext)

      // If there's an existing conversation, insert a visual divider first
      if (hasExistingConversation) {
        addDividerRef.current(getDividerLabel(pendingSidebarContext))
      }

      // Clear sidebar context from app state so navigating away and back doesn't re-trigger
      setActiveSidebarContext(null)
      // Use ref to avoid depending on sendMessage identity
      sendMessageRef.current(message)
    }
  }, [pendingSidebarContext, isInitialized, isLoading, hasExistingConversation, setActiveSidebarContext])

  // Show follow-up suggestions after auto-sent message response completes
  useEffect(() => {
    if (pendingSidebarContext && autoSentRef.current && !isLoading && messages.length >= 3) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === 'assistant' && !lastMsg.isStreaming) {
        setShowFollowUps(true)
      }
    }
  }, [pendingSidebarContext, isLoading, messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Show welcome only when there's just the init message and no pending sidebar action
  const showWelcome = messages.length <= 1 && !isLoading && !pendingSidebarContext

  const suggestedPrompts = useMemo(() => {
    if (activeSidebarContext) return getSidebarContextPrompts(activeSidebarContext)
    if (activeHoldingContext) return getContextualPrompts(activeHoldingContext.ticker)
    return DEFAULT_PROMPTS
  }, [activeHoldingContext, activeSidebarContext])

  // Follow-up prompts (remaining after auto-send)
  const followUpPrompts = useMemo(() => {
    if (!pendingSidebarContext) return []
    return getSidebarContextPrompts(pendingSidebarContext).slice(1)
  }, [pendingSidebarContext])

  const handleSend = useCallback(
    (content: string) => {
      setUserSentManual(true)
      setShowFollowUps(false)
      sendMessage(content)
    },
    [sendMessage],
  )

  const handleFollowUp = useCallback(
    (prompt: string) => {
      setShowFollowUps(false)
      setUserSentManual(true)
      sendMessage(prompt)
    },
    [sendMessage],
  )

  // Portfolio context summary from exposure data
  const portfolioSummary = useMemo(() => {
    if (!exposureMap) return null
    const topExposures = [...exposureMap.exposures]
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)
    return {
      topExposures,
      warningCount: exposureMap.warnings.length,
      overlapCount: exposureMap.overlaps.length,
    }
  }, [exposureMap])

  // Hide init greeting on welcome screen; show all messages otherwise (including dividers)
  const visibleMessages = showWelcome ? messages.slice(1) : messages

  return (
    <div className="insights-view">
      <div className="insights-view__messages">
        {isLoading && messages.length === 0 && (
          <p className="insights-view__loading">Initializing Ask Prism...</p>
        )}

        {error && <p className="insights-view__error">{error}</p>}

        {visibleMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Follow-up suggestion chips after auto-sent response */}
        {showFollowUps && !userSentManual && followUpPrompts.length > 0 && (
          <div className="insights-view__follow-ups">
            <p className="insights-view__follow-ups-label">Follow up:</p>
            <div className="insights-view__follow-ups-chips">
              {followUpPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="insights-view__follow-up-chip"
                  onClick={() => handleFollowUp(prompt)}
                  disabled={isLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {showWelcome && (
          <div className="insights-view__welcome">
            <h2 className="insights-view__welcome-title">Ask Prism</h2>
            <p className="insights-view__welcome-subtitle">
              Ask me about your portfolio, exposure, or market conditions
            </p>

            {portfolioSummary && (
              <div className="insights-view__portfolio-context">
                <p className="insights-view__portfolio-context-title">Your portfolio context</p>
                <div className="insights-view__portfolio-context-items">
                  {portfolioSummary.topExposures.map((exp) => (
                    <span key={exp.category} className="insights-view__portfolio-context-item">
                      {exp.category}: {exp.percentage.toFixed(1)}%
                    </span>
                  ))}
                  {portfolioSummary.warningCount > 0 && (
                    <span className="insights-view__portfolio-context-item insights-view__portfolio-context-item--warning">
                      {portfolioSummary.warningCount} concentration warning{portfolioSummary.warningCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {portfolioSummary.overlapCount > 0 && (
                    <span className="insights-view__portfolio-context-item">
                      {portfolioSummary.overlapCount} holding overlap{portfolioSummary.overlapCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            )}

            {activeHoldingContext && (
              <div className="insights-view__context-badge">
                Asking about <strong>{activeHoldingContext.ticker}</strong>
                <span className="insights-view__context-badge-sub">
                  {activeHoldingContext.name} · {activeHoldingContext.accountType.replace('_', ' ')}
                </span>
              </div>
            )}

            <div className="insights-view__suggestions">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="insights-view__suggestion"
                  onClick={() => handleSend(prompt)}
                  disabled={isLoading}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="insights-view__input-area">
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  )
}
