import { type ReactNode, useState, useCallback } from 'react'
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat'
import { SourceCitation } from './SourceCitation'

interface ChatMessageProps {
  readonly message: ChatMessageType
  readonly onFollowUp?: (query: string) => void
}

function renderInlineMarkdown(content: string, keyPrefix: string): ReadonlyArray<ReactNode> {
  const parts: Array<ReactNode> = []
  const inlineRegex = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null = null
  let tokenIndex = 0

  while ((match = inlineRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }

    if (match[1] !== undefined) {
      parts.push(<code key={`${keyPrefix}-code-${tokenIndex}`}>{match[1]}</code>)
    } else if (match[2] !== undefined && match[3] !== undefined) {
      parts.push(
        <SourceCitation
          key={`${keyPrefix}-link-${tokenIndex}`}
          title={match[2]}
          url={match[3]}
        />,
      )
    } else if (match[4] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-strong-${tokenIndex}`}>{match[4]}</strong>)
    } else if (match[5] !== undefined) {
      parts.push(<em key={`${keyPrefix}-em-${tokenIndex}`}>{match[5]}</em>)
    }

    tokenIndex += 1
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts
}

function isUnorderedList(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line)
}

function isOrderedList(line: string): boolean {
  return /^\s*\d+\.\s+/.test(line)
}

function stripUnorderedPrefix(line: string): string {
  return line.replace(/^\s*[-*+]\s+/, '')
}

function stripOrderedPrefix(line: string): string {
  return line.replace(/^\s*\d+\.\s+/, '')
}

function renderMarkdown(content: string): ReadonlyArray<ReactNode> {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: Array<ReactNode> = []
  let i = 0
  let blockIndex = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim()
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      if (i < lines.length && lines[i].trim().startsWith('```')) i += 1
      blocks.push(
        <pre key={`block-${blockIndex}`} className="chat-message__code-block">
          <code data-language={language || undefined}>{codeLines.join('\n')}</code>
        </pre>,
      )
      blockIndex += 1
      continue
    }

    const headingMatch = line.match(/^\s*(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const headingContent = renderInlineMarkdown(headingMatch[2], `h-${blockIndex}`)
      if (level === 1) blocks.push(<h1 key={`block-${blockIndex}`}>{headingContent}</h1>)
      else if (level === 2) blocks.push(<h2 key={`block-${blockIndex}`}>{headingContent}</h2>)
      else if (level === 3) blocks.push(<h3 key={`block-${blockIndex}`}>{headingContent}</h3>)
      else if (level === 4) blocks.push(<h4 key={`block-${blockIndex}`}>{headingContent}</h4>)
      else if (level === 5) blocks.push(<h5 key={`block-${blockIndex}`}>{headingContent}</h5>)
      else blocks.push(<h6 key={`block-${blockIndex}`}>{headingContent}</h6>)
      i += 1
      blockIndex += 1
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`block-${blockIndex}`} />)
      i += 1
      blockIndex += 1
      continue
    }

    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''))
        i += 1
      }
      blocks.push(
        <blockquote key={`block-${blockIndex}`}>
          {renderInlineMarkdown(quoteLines.join(' '), `q-${blockIndex}`)}
        </blockquote>,
      )
      blockIndex += 1
      continue
    }

    if (isUnorderedList(line)) {
      const items: Array<ReactNode> = []
      while (i < lines.length && isUnorderedList(lines[i])) {
        const itemText = stripUnorderedPrefix(lines[i])
        items.push(
          <li key={`li-${blockIndex}-${items.length}`}>
            {renderInlineMarkdown(itemText, `ul-${blockIndex}-${items.length}`)}
          </li>,
        )
        i += 1
      }
      blocks.push(<ul key={`block-${blockIndex}`}>{items}</ul>)
      blockIndex += 1
      continue
    }

    if (isOrderedList(line)) {
      const items: Array<ReactNode> = []
      while (i < lines.length && isOrderedList(lines[i])) {
        const itemText = stripOrderedPrefix(lines[i])
        items.push(
          <li key={`li-${blockIndex}-${items.length}`}>
            {renderInlineMarkdown(itemText, `ol-${blockIndex}-${items.length}`)}
          </li>,
        )
        i += 1
      }
      blocks.push(<ol key={`block-${blockIndex}`}>{items}</ol>)
      blockIndex += 1
      continue
    }

    const paragraphLines: string[] = []
    while (i < lines.length) {
      const next = lines[i]
      const nextTrim = next.trim()
      if (!nextTrim) break
      if (
        nextTrim.startsWith('```') ||
        /^\s*(#{1,6})\s+/.test(next) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(nextTrim) ||
        /^\s*>/.test(next) ||
        isUnorderedList(next) ||
        isOrderedList(next)
      ) {
        break
      }
      paragraphLines.push(next)
      i += 1
    }
    const paragraphNodes: Array<ReactNode> = []
    paragraphLines.forEach((paragraphLine, index) => {
      paragraphNodes.push(...renderInlineMarkdown(paragraphLine, `p-${blockIndex}-${index}`))
      if (index < paragraphLines.length - 1) {
        paragraphNodes.push(<br key={`p-br-${blockIndex}-${index}`} />)
      }
    })
    blocks.push(<p key={`block-${blockIndex}`}>{paragraphNodes}</p>)
    blockIndex += 1
  }

  return blocks
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

  return followUps.slice(0, 3)
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

  return (
    <div className={`chat-message chat-message--${message.role}`}>
      <div className="chat-message__bubble">
        {isAssistant ? (
          <div className="chat-message__markdown">{renderMarkdown(message.content)}</div>
        ) : (
          <p className="chat-message__text">{message.content}</p>
        )}
        {isStreaming && (
          <span className="chat-message__cursor" aria-hidden="true" />
        )}
      </div>
      {showActions && (
        <div className="chat-message__actions">
          <CopyButton content={message.content} />
        </div>
      )}
      {showActions && onFollowUp && (
        <div className="chat-message__follow-ups">
          {generateFollowUps(message.content).map((query) => (
            <button
              key={query}
              className="chat-message__follow-up-chip"
              onClick={() => onFollowUp(query)}
            >
              {query}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
