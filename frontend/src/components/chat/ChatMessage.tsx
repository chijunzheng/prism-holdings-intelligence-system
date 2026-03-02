import { useState, useCallback } from 'react'
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat'
import { renderMarkdown } from './render-markdown'

interface ChatMessageProps {
  readonly message: ChatMessageType
  readonly onFollowUp?: (query: string) => void
}

// Generate context-aware follow-up queries based on the assistant response
function generateFollowUps(content: string): readonly string[] {
  const lower = content.toLowerCase()
  const followUps: string[] = []

  // Signal-related follow-ups
  if (lower.includes('signal') || lower.includes('market event') || lower.includes('affecting')) {
    followUps.push('Run a full portfolio review')
    followUps.push('Which signal is most urgent?')
  }

  // Risk/exposure follow-ups
  if (lower.includes('exposure') || lower.includes('concentration') || lower.includes('risk')) {
    followUps.push('How diversified am I really?')
    followUps.push('What happens in a recession?')
  }

  // Holdings-specific follow-ups
  if (lower.includes('vfv') || lower.includes('tech') || lower.includes('technology')) {
    followUps.push('Show me my tech exposure breakdown')
  }
  if (lower.includes('zeb') || lower.includes('bank') || lower.includes('financial')) {
    followUps.push('How do rate changes affect my banks?')
  }
  if (lower.includes('xeg') || lower.includes('energy') || lower.includes('oil')) {
    followUps.push('Is my energy exposure too concentrated?')
  }

  // Goal-related follow-ups
  if (lower.includes('house') || lower.includes('down payment') || lower.includes('fhsa')) {
    followUps.push('Am I on track for my down payment goal?')
  }
  if (lower.includes('retire') || lower.includes('horizon') || lower.includes('long-term')) {
    followUps.push('What should I prioritize for retirement?')
  }

  // General follow-ups if nothing specific matched
  if (followUps.length === 0) {
    followUps.push('What signals are affecting my portfolio?')
    followUps.push('How can I reduce my risk?')
  }

  // Always add a "do nothing" / overview option
  if (!followUps.some((f) => f.toLowerCase().includes('portfolio review'))) {
    followUps.push('What are my options?')
  }

  return [...new Set(followUps)].slice(0, 2)
}

function CopyButton({ content }: { readonly content: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [content])

  return (
    <button
      className="chat-message__copy-btn"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="4.5" y="4.5" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

export function ChatMessage({ message, onFollowUp }: ChatMessageProps) {
  if (message.role === 'divider') {
    return (
      <div className="chat-message chat-message--divider">
        <span className="chat-message__divider-label">{message.content}</span>
      </div>
    )
  }

  const isAssistant = message.role === 'assistant'
  const isStreaming = message.isStreaming ?? false
  const showActions = isAssistant && !isStreaming && message.content.length > 0

  // Use LLM-powered suggestions if available, fall back to keyword-based
  const followUps = message.suggestedFollowUps && message.suggestedFollowUps.length > 0
    ? message.suggestedFollowUps
    : generateFollowUps(message.content)

  return (
    <div className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__bubble">
        {isAssistant ? (
          <div className="chat-message__markdown">{renderMarkdown(message.content)}</div>
        ) : (
          <p className="chat-message__text">{message.content}</p>
        )}
      </div>
      {showActions && (
        <div className="chat-message__actions">
          <CopyButton content={message.content} />
        </div>
      )}
      {showActions && onFollowUp && followUps.length > 0 && (
        <div className="chat-message__follow-ups">
          <span className="chat-message__follow-ups-label">Follow-ups</span>
          <div className="chat-message__suggestion-pills">
            {followUps.map((query) => (
              <button
                key={query}
                className="chat-message__suggestion-pill"
                onClick={() => onFollowUp(query)}
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
