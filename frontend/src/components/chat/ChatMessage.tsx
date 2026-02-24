import type { ReactNode } from 'react'
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat'
import { SourceCitation } from './SourceCitation'

interface ChatMessageProps {
  readonly message: ChatMessageType
}

/**
 * Renders markdown-like citations as links and basic formatting.
 * Detects [Title](url) patterns from assistant messages.
 */
function renderContent(content: string): ReadonlyArray<ReactNode> {
  const parts: Array<ReactNode> = []
  const citationRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null = null

  while ((match = citationRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }
    parts.push(
      <SourceCitation key={match.index} title={match[1]} url={match[2]} />,
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant'

  return (
    <div className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__bubble">
        <p className="chat-message__text">
          {isAssistant ? renderContent(message.content) : message.content}
        </p>
        {message.isStreaming && (
          <span className="chat-message__cursor" aria-hidden="true" />
        )}
      </div>
    </div>
  )
}
