import { useState } from 'react'
import { renderMarkdown } from '../chat/render-markdown'

interface CollapsibleReasoningProps {
  readonly text: string
  readonly durationSec?: number
}

function formatDuration(sec: number): string {
  if (sec < 1) return 'Thought for <1 second'
  const rounded = Math.round(sec)
  return `Thought for ${rounded} second${rounded === 1 ? '' : 's'}`
}

export function CollapsibleReasoning({ text, durationSec }: CollapsibleReasoningProps) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return null

  const label = durationSec != null ? formatDuration(durationSec) : 'Thinking'

  return (
    <div className="chat-card chat-card--thinking" style={{ cursor: 'pointer' }} onClick={() => setExpanded((prev) => !prev)}>
      <div className="chat-card__thinking-indicator">
        <span className="chat-card__check" aria-hidden="true">&#x2713;</span>
        <span className="chat-card__stage-label">{label}</span>
        <svg
          style={{
            marginLeft: 'auto',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            color: 'var(--color-text-muted, #71717A)',
          }}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      {expanded && (
        <div className="chat-card__thinking-detail" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {renderMarkdown(text)}
        </div>
      )}
    </div>
  )
}
