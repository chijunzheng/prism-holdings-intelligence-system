import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AskPrismEntryContext,
  AskPrismPage,
  AskPrismPlanAction,
  AskPrismSessionScope,
  PlanSelection,
  StrategyCandidate,
} from '@prism/shared'
import { Link } from 'react-router-dom'
import { useAppContext } from '../../contexts/AppContext'
import type { SidebarContext } from '../../contexts/AppContext'
import { useAskPrismChat } from '../../hooks/useChat'
import { usePageContext } from '../../hooks/usePageContext'
import { useExposureData } from '../../hooks/useExposureData'
import {
  buildFollowUpQueries,
  buildNavigationChips,
  buildWelcomeContextCard,
  getAskPrismComposerPlaceholder,
  getAskPrismWelcomeSubtitle,
} from './ask-prism-drawer-utils'
import { ChatMessage } from '../chat/ChatMessage'
import { ChatInput } from '../chat/ChatInput'
import '../../styles/ask-prism-drawer.css'
import '../../styles/chat.css'

const PAGE_PROMPTS: Record<AskPrismPage, ReadonlyArray<string>> = {
  portfolio: [
    "What's my biggest risk?",
    'Explain my overlaps',
    'Compare my signals',
    'How diversified is my portfolio?',
  ],
  signals_overview: [
    'Which live signal is driving most downside?',
    'What changed most this week?',
    'Where is my biggest regime risk?',
    'How should I monitor this setup?',
  ],
  signal: [
    'What if this reverses?',
    'How confident is this?',
    'Show the other side',
    'What should I watch for?',
  ],
  plan: [
    'Why does this help?',
    'What are the risks?',
    'What am I missing?',
    'Is there a better option?',
  ],
}

const DEFAULT_PROMPTS = PAGE_PROMPTS.portfolio

function sessionScopeLabel(scope: AskPrismSessionScope): string {
  if (scope === 'global') return 'Global Thread'
  if (scope.startsWith('node:')) return 'Node Thread'
  if (scope.startsWith('plan:')) return 'Plan Thread'
  return 'Signal Thread'
}

function buildEntryAutoPrompt(entryContext: AskPrismEntryContext): string {
  if (entryContext.autoPrompt) return entryContext.autoPrompt
  if (entryContext.entryType === 'graph_node' && entryContext.nodeLabel) {
    return `Explain how ${entryContext.nodeLabel} affects my holdings and what I should watch next.`
  }
  if (entryContext.entryType === 'signals_canvas') {
    return 'Summarize the current full regime impact across my holdings and highlight the biggest downside path.'
  }
  if (entryContext.signalId) {
    return `Analyze signal ${entryContext.signalId} in detail and explain its transmission path through my portfolio.`
  }
  return 'Ground me on my current portfolio risk and the strongest active signals.'
}

function entryDividerLabel(entryContext: AskPrismEntryContext): string {
  if (entryContext.entryType === 'graph_node' && entryContext.nodeLabel) {
    return `New topic: ${entryContext.nodeLabel}`
  }
  if (entryContext.entryType === 'signals_canvas') {
    return 'New topic: Full signals regime'
  }
  if (entryContext.signalId) {
    return `New topic: Signal ${entryContext.signalId}`
  }
  return 'New topic: Ask Prism'
}

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
  readonly planSelections?: ReadonlyArray<PlanSelection>
  readonly planCandidates?: ReadonlyArray<StrategyCandidate>
  readonly onApplyPlanActions?: (
    actions: ReadonlyArray<AskPrismPlanAction>,
  ) => Promise<void> | void
}

export function AskPrismDrawer({
  onClose,
  planSelections,
  planCandidates,
  onApplyPlanActions,
}: AskPrismDrawerProps) {
  const {
    userId,
    activeHoldingContext,
    activeSidebarContext,
    activeAskPrismEntryContext,
    setActiveSidebarContext,
    setActiveAskPrismEntryContext,
  } = useAppContext()
  const { page, signalId } = usePageContext()
  const { messages, isLoading, error, sessionScope, sendMessage, addDivider } = useAskPrismChat({
    userId,
    page,
    signalId,
    entryContext: activeAskPrismEntryContext,
    planSelections,
    planCandidates,
  })
  const { exposureMap } = useExposureData(userId)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sendMessageRef = useRef(sendMessage)
  const addDividerRef = useRef(addDivider)
  const autoSentRef = useRef(false)
  const entryAutoSentKeyRef = useRef<string | null>(null)
  const [pendingSidebarContext, setPendingSidebarContext] = useState<SidebarContext | null>(null)
  const [dismissedProposalIds, setDismissedProposalIds] = useState<ReadonlySet<string>>(new Set())
  const [appliedProposalIds, setAppliedProposalIds] = useState<ReadonlySet<string>>(new Set())
  const [applyingProposalIds, setApplyingProposalIds] = useState<ReadonlySet<string>>(new Set())
  const [proposalErrorById, setProposalErrorById] = useState<ReadonlyMap<string, string>>(new Map())
  const hasExistingConversation = messages.length > 1
  const entryContextKey = useMemo(() => {
    if (!activeAskPrismEntryContext) return null
    return [
      activeAskPrismEntryContext.entryType,
      activeAskPrismEntryContext.signalId ?? '',
      activeAskPrismEntryContext.nodeId ?? '',
      activeAskPrismEntryContext.autoPrompt ?? '',
    ].join(':')
  }, [activeAskPrismEntryContext])

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

  // Clear transient entry context when drawer closes
  useEffect(() => {
    return () => {
      setActiveAskPrismEntryContext(null)
    }
  }, [setActiveAskPrismEntryContext])

  // Capture sidebar context on change
  useEffect(() => {
    if (activeSidebarContext) {
      setPendingSidebarContext(activeSidebarContext)
      autoSentRef.current = false
    }
  }, [activeSidebarContext])

  // Auto-send sidebar prompt
  useEffect(() => {
    if (pendingSidebarContext && !isLoading && !autoSentRef.current) {
      autoSentRef.current = true
      const message = buildAutoSendMessage(pendingSidebarContext)

      if (hasExistingConversation) {
        addDividerRef.current(getDividerLabel(pendingSidebarContext))
      }

      setActiveSidebarContext(null)
      sendMessageRef.current(message)
    }
  }, [pendingSidebarContext, isLoading, hasExistingConversation, setActiveSidebarContext])

  // Auto-send entry-context prompt (node/canvas/signal)
  useEffect(() => {
    if (!activeAskPrismEntryContext || !entryContextKey || isLoading) return
    if (entryAutoSentKeyRef.current === entryContextKey) return

    entryAutoSentKeyRef.current = entryContextKey
    if (hasExistingConversation) {
      addDividerRef.current(entryDividerLabel(activeAskPrismEntryContext))
    }
    sendMessageRef.current(buildEntryAutoPrompt(activeAskPrismEntryContext))
  }, [
    activeAskPrismEntryContext,
    entryContextKey,
    hasExistingConversation,
    isLoading,
  ])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const hasConversationTurns = useMemo(
    () => messages.some((message) => message.role === 'user' || message.role === 'assistant'),
    [messages],
  )

  const showWelcome =
    !hasConversationTurns &&
    !isLoading &&
    !pendingSidebarContext &&
    !activeAskPrismEntryContext

  const suggestedPrompts = useMemo(() => {
    if (activeSidebarContext) return getSidebarContextPrompts(activeSidebarContext)
    if (activeHoldingContext) return getContextualPrompts(activeHoldingContext.ticker)
    return PAGE_PROMPTS[page] ?? DEFAULT_PROMPTS
  }, [activeHoldingContext, activeSidebarContext, page])

  const assistantAssistByMessageId = useMemo(() => {
    const map = new Map<
      string,
      {
        readonly navigationChips: ReturnType<typeof buildNavigationChips>
        readonly followUpQueries: ReturnType<typeof buildFollowUpQueries>
      }
    >()

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index]
      if (message.role !== 'assistant' || message.isStreaming || !message.content.trim()) continue

      let priorUserMessage = ''
      for (let seek = index - 1; seek >= 0; seek -= 1) {
        if (messages[seek].role === 'user') {
          priorUserMessage = messages[seek].content
          break
        }
      }

      const turnContext = `${priorUserMessage} ${message.content}`.toLowerCase()
      map.set(message.id, {
        navigationChips: buildNavigationChips(page, signalId, turnContext),
        followUpQueries:
          message.suggestedFollowUps && message.suggestedFollowUps.length > 0
            ? message.suggestedFollowUps.slice(0, 3)
            : buildFollowUpQueries(page, turnContext, activeHoldingContext?.ticker),
      })
    }

    return map
  }, [activeHoldingContext?.ticker, messages, page, signalId])

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content)
    },
    [sendMessage],
  )

  const handleDismissProposal = useCallback((messageId: string) => {
    setDismissedProposalIds((prev) => new Set(prev).add(messageId))
  }, [])

  const handleApplyProposal = useCallback(
    async (messageId: string, actions: ReadonlyArray<AskPrismPlanAction>) => {
      if (!onApplyPlanActions || actions.length === 0) return

      setApplyingProposalIds((prev) => new Set(prev).add(messageId))
      setProposalErrorById((prev) => {
        const next = new Map(prev)
        next.delete(messageId)
        return next
      })

      try {
        await onApplyPlanActions(actions)
        setAppliedProposalIds((prev) => new Set(prev).add(messageId))
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to apply proposal'
        setProposalErrorById((prev) => {
          const next = new Map(prev)
          next.set(messageId, errorMessage)
          return next
        })
      } finally {
        setApplyingProposalIds((prev) => {
          const next = new Set(prev)
          next.delete(messageId)
          return next
        })
      }
    },
    [onApplyPlanActions],
  )

  const contextCard = useMemo(
    () =>
      buildWelcomeContextCard({
        page,
        signalId,
        entryContext: activeAskPrismEntryContext,
        exposureMap,
        planSelections,
        holdingTicker: activeHoldingContext?.ticker,
      }),
    [activeAskPrismEntryContext, activeHoldingContext?.ticker, exposureMap, page, planSelections, signalId],
  )

  const welcomeSubtitle = useMemo(
    () => getAskPrismWelcomeSubtitle(page, activeAskPrismEntryContext),
    [activeAskPrismEntryContext, page],
  )

  const composerPlaceholder = useMemo(
    () => getAskPrismComposerPlaceholder(page, activeAskPrismEntryContext),
    [activeAskPrismEntryContext, page],
  )

  return (
    <div className="ask-prism-overlay" role="dialog" aria-label="Ask Prism">
      <div className="ask-prism-backdrop" onClick={onClose} />
      <div className="ask-prism-drawer">
        <div className="ask-prism-drawer__header">
          <div className="ask-prism-drawer__header-title">
            <span className="ask-prism-drawer__title">Ask Prism</span>
            <span className="ask-prism-drawer__scope-pill">{sessionScopeLabel(sessionScope)}</span>
          </div>
          <button type="button" className="ask-prism-drawer__close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="ask-prism-drawer__messages">
          {isLoading && messages.length === 0 && (
            <p className="ask-prism-drawer__loading">Initializing...</p>
          )}

          {error && <p className="ask-prism-drawer__error">{error}</p>}

          {messages.map((msg) => {
            const inlineAssist = assistantAssistByMessageId.get(msg.id)
            const planProposal = msg.planProposal
            const proposalError = proposalErrorById.get(msg.id)
            const proposalDismissed = dismissedProposalIds.has(msg.id)
            const proposalApplied = appliedProposalIds.has(msg.id)
            const proposalApplying = applyingProposalIds.has(msg.id)

            return (
              <Fragment key={msg.id}>
                <ChatMessage message={msg} />
                {msg.role === 'assistant' && planProposal && !proposalDismissed && (
                  <div className="ask-prism-drawer__proposal">
                    <p className="ask-prism-drawer__proposal-title">Proposed Playbook Update</p>
                    <p className="ask-prism-drawer__proposal-rationale">{planProposal.rationale}</p>
                    <div className="ask-prism-drawer__proposal-actions">
                      {planProposal.actions.map((action, index) => (
                        <span key={`${msg.id}-action-${index}`} className="ask-prism-drawer__proposal-action-pill">
                          {action.type === 'add_candidate' && `Add ${action.ticker} (${action.allocationPct.toFixed(1)}%)`}
                          {action.type === 'remove_candidate' && `Remove ${action.ticker}`}
                          {action.type === 'set_allocation' &&
                            `Set ${action.ticker} to ${action.allocationPct.toFixed(1)}%`}
                        </span>
                      ))}
                    </div>
                    {planProposal.expectedEffects.length > 0 && (
                      <div className="ask-prism-drawer__proposal-effects">
                        {planProposal.expectedEffects.map((effect) => (
                          <p key={`${msg.id}-${effect}`} className="ask-prism-drawer__proposal-effect">
                            {effect}
                          </p>
                        ))}
                      </div>
                    )}
                    {planProposal.warnings.length > 0 && (
                      <div className="ask-prism-drawer__proposal-warnings">
                        {planProposal.warnings.map((warning) => (
                          <p key={`${msg.id}-${warning}`} className="ask-prism-drawer__proposal-warning">
                            {warning}
                          </p>
                        ))}
                      </div>
                    )}
                    {proposalError && (
                      <p className="ask-prism-drawer__proposal-error">{proposalError}</p>
                    )}
                    <div className="ask-prism-drawer__proposal-cta-row">
                      <button
                        type="button"
                        className="ask-prism-drawer__proposal-cta ask-prism-drawer__proposal-cta--primary"
                        onClick={() => handleApplyProposal(msg.id, planProposal.actions)}
                        disabled={proposalApplying || proposalApplied || !onApplyPlanActions}
                      >
                        {proposalApplied ? 'Applied' : proposalApplying ? 'Applying...' : 'Apply To Playbook'}
                      </button>
                      <button
                        type="button"
                        className="ask-prism-drawer__proposal-cta"
                        onClick={() => handleDismissProposal(msg.id)}
                        disabled={proposalApplying}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
                {inlineAssist && (
                  <div className="ask-prism-drawer__inline-assist">
                    <div className="ask-prism-drawer__inline-assist-row">
                      {inlineAssist.navigationChips.map((chip) => (
                        <Link
                          key={`${msg.id}-${chip.to}`}
                          to={chip.to}
                          className="ask-prism-drawer__follow-up-chip ask-prism-drawer__follow-up-chip--link ask-prism-drawer__follow-up-chip--nav"
                          onClick={onClose}
                        >
                          {chip.label}
                        </Link>
                      ))}
                    </div>
                    <div className="ask-prism-drawer__inline-assist-row">
                      {inlineAssist.followUpQueries.map((prompt) => (
                        <button
                          key={`${msg.id}-${prompt}`}
                          type="button"
                          className="ask-prism-drawer__follow-up-chip"
                          onClick={() => handleSend(prompt)}
                          disabled={isLoading}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Fragment>
            )
          })}

          {showWelcome && (
            <div className="ask-prism-drawer__welcome">
              <h2 className="ask-prism-drawer__welcome-title">Ask Prism</h2>
              <p className="ask-prism-drawer__welcome-subtitle">{welcomeSubtitle}</p>

              <div className="ask-prism-drawer__welcome-context">
                <p className="ask-prism-drawer__welcome-context-title">{contextCard.title}</p>
                <div className="ask-prism-drawer__welcome-context-items">
                  {contextCard.badges.map((badge) => (
                    <span
                      key={badge.label}
                      className={`ask-prism-drawer__welcome-context-item${badge.warning ? ' ask-prism-drawer__welcome-context-item--warning' : ''}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>

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
          <ChatInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder={composerPlaceholder}
            minRows={3}
          />
        </div>
      </div>
    </div>
  )
}
