import { useEffect, useMemo, useRef } from 'react'
import { useAppContext } from '../contexts/AppContext'
import { useChat } from '../hooks/useChat'
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

export function InsightsView() {
  const { userId, activeHoldingContext } = useAppContext()
  const { messages, isLoading, error, sendMessage } = useChat({
    userId,
    mode: 'general',
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showWelcome = messages.length <= 1 && !isLoading

  const suggestedPrompts = useMemo(
    () => activeHoldingContext
      ? getContextualPrompts(activeHoldingContext.ticker)
      : DEFAULT_PROMPTS,
    [activeHoldingContext],
  )

  return (
    <div className="insights-view">
      <div className="insights-view__messages">
        {isLoading && messages.length === 0 && (
          <p className="insights-view__loading">Initializing Ask Prism...</p>
        )}

        {error && <p className="insights-view__error">{error}</p>}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {showWelcome && (
          <div className="insights-view__welcome">
            <h2 className="insights-view__welcome-title">Ask Prism</h2>
            <p className="insights-view__welcome-subtitle">
              Ask me about your portfolio, exposure, or market conditions
            </p>

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
                  onClick={() => sendMessage(prompt)}
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
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  )
}
