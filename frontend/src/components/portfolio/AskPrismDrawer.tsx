import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppContext } from '../../contexts/AppContext'
import type { SidebarContext } from '../../contexts/AppContext'
import { useChat } from '../../hooks/useChat'
import { useExposureData } from '../../hooks/useExposureData'
import { ChatMessage } from '../chat/ChatMessage'
import { ChatInput } from '../chat/ChatInput'
import '../../styles/ask-prism-drawer.css'
import '../../styles/chat.css'

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
    case 'health':
      return [
        `My portfolio health is ${ctx.label}. ${ctx.detail} What should I focus on improving?`,
        'How can I improve my portfolio health score?',
        'What are the biggest risks in my portfolio right now?',
        'Should I rebalance to reduce concentration and overlap?',
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
    case 'health':
      return `My portfolio health is ${ctx.label}. ${ctx.detail} What should I focus on improving?`
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
    case 'health':
      return `New topic: Portfolio health analysis`
    case 'exposure':
      return `New topic: Exposure analysis`
  }
}

interface AskPrismDrawerProps {
  readonly onClose: () => void
}

export function AskPrismDrawer({ onClose }: AskPrismDrawerProps) {
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
  const hasExistingConversation = messages.length > 1

  sendMessageRef.current = sendMessage
  addDividerRef.current = addDivider

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Capture sidebar context on change
  useEffect(() => {
    if (activeSidebarContext) {
      setPendingSidebarContext(activeSidebarContext)
      autoSentRef.current = false
      setShowFollowUps(false)
      setUserSentManual(false)
    }
  }, [activeSidebarContext])

  // Auto-send when chat is ready
  useEffect(() => {
    if (pendingSidebarContext && isInitialized && !isLoading && !autoSentRef.current) {
      autoSentRef.current = true
      const message = buildAutoSendMessage(pendingSidebarContext)

      if (hasExistingConversation) {
        addDividerRef.current(getDividerLabel(pendingSidebarContext))
      }

      setActiveSidebarContext(null)
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

  const showWelcome = messages.length <= 1 && !isLoading && !pendingSidebarContext

  const suggestedPrompts = useMemo(() => {
    if (activeSidebarContext) return getSidebarContextPrompts(activeSidebarContext)
    if (activeHoldingContext) return getContextualPrompts(activeHoldingContext.ticker)
    return DEFAULT_PROMPTS
  }, [activeHoldingContext, activeSidebarContext])

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

  const visibleMessages = showWelcome ? messages.slice(1) : messages

  return (
    <div className="ask-prism-overlay" role="dialog" aria-label="Ask Prism">
      <div className="ask-prism-backdrop" onClick={onClose} />
      <div className="ask-prism-drawer">
        <div className="ask-prism-drawer__header">
          <span className="ask-prism-drawer__title">Ask Prism</span>
          <button type="button" className="ask-prism-drawer__close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="ask-prism-drawer__messages">
          {isLoading && messages.length === 0 && (
            <p className="ask-prism-drawer__loading">Initializing...</p>
          )}

          {error && <p className="ask-prism-drawer__error">{error}</p>}

          {visibleMessages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {showFollowUps && !userSentManual && followUpPrompts.length > 0 && (
            <div className="ask-prism-drawer__follow-ups">
              <p className="ask-prism-drawer__follow-ups-label">Follow up:</p>
              <div className="ask-prism-drawer__follow-ups-chips">
                {followUpPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ask-prism-drawer__follow-up-chip"
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
            <div className="ask-prism-drawer__welcome">
              <h2 className="ask-prism-drawer__welcome-title">Ask Prism</h2>
              <p className="ask-prism-drawer__welcome-subtitle">
                Ask about your portfolio, exposure, or market conditions
              </p>

              {portfolioSummary && (
                <div className="ask-prism-drawer__portfolio-context">
                  <p className="ask-prism-drawer__portfolio-context-title">Your portfolio</p>
                  <div className="ask-prism-drawer__portfolio-context-items">
                    {portfolioSummary.topExposures.map((exp) => (
                      <span key={exp.category} className="ask-prism-drawer__portfolio-context-item">
                        {exp.category}: {exp.percentage.toFixed(1)}%
                      </span>
                    ))}
                    {portfolioSummary.warningCount > 0 && (
                      <span className="ask-prism-drawer__portfolio-context-item ask-prism-drawer__portfolio-context-item--warning">
                        {portfolioSummary.warningCount} warning{portfolioSummary.warningCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {portfolioSummary.overlapCount > 0 && (
                      <span className="ask-prism-drawer__portfolio-context-item">
                        {portfolioSummary.overlapCount} overlap{portfolioSummary.overlapCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {activeHoldingContext && (
                <div className="ask-prism-drawer__context-badge">
                  Asking about <strong>{activeHoldingContext.ticker}</strong>
                  <span className="ask-prism-drawer__context-badge-sub">
                    {activeHoldingContext.name} · {activeHoldingContext.accountType.replace('_', ' ')}
                  </span>
                </div>
              )}

              <div className="ask-prism-drawer__suggestions">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ask-prism-drawer__suggestion"
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

        <div className="ask-prism-drawer__input">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </div>
    </div>
  )
}
