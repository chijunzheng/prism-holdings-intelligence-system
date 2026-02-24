import { useEffect, useRef } from 'react'
import type { CausalChain, CausalChainNode, Signal } from '@prism/shared'
import type { TemporalAnalysis } from '../../types/graph'
import { useChat } from '../../hooks/useChat'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { SuggestedPrompts } from './SuggestedPrompts'
import { Disclaimer } from '../shared/Disclaimer'

interface ChatPanelProps {
  readonly userId: string
  readonly node: CausalChainNode | null
  readonly chain: CausalChain | null
  readonly signal: Signal | null
  readonly temporalAnalysis: TemporalAnalysis | null
  readonly onClose: () => void
}

export function ChatPanel({
  userId,
  node,
  chain,
  signal,
  temporalAnalysis,
  onClose,
}: ChatPanelProps) {
  const { messages, isLoading, error, sendMessage } = useChat({
    userId,
    node,
    chain,
    signal,
    temporalAnalysis,
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const showSuggested = messages.length <= 1 && !isLoading

  return (
    <div className="chat-panel">
      <div className="chat-panel__header">
        <div>
          <h3>Chat</h3>
          {node && (
            <p className="chat-panel__scope">
              Scoped to: <strong>{node.label}</strong>
            </p>
          )}
        </div>
        <button type="button" className="chat-panel__close" onClick={onClose}>
          Close
        </button>
      </div>

      {!node && (
        <p className="chat-panel__placeholder">
          Click a node on the graph to start a contextual conversation.
        </p>
      )}

      {node && (
        <>
          <div className="chat-panel__messages">
            {isLoading && messages.length === 0 && (
              <div className="chat-panel__loading">Analyzing node context...</div>
            )}

            {error && (
              <div className="chat-panel__error">
                {error}
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            <div ref={messagesEndRef} />
          </div>

          {showSuggested && (
            <SuggestedPrompts onSelect={sendMessage} disabled={isLoading} />
          )}

          <ChatInput onSend={sendMessage} disabled={isLoading} />

          <Disclaimer compact />
        </>
      )}
    </div>
  )
}
