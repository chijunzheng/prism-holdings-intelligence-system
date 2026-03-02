import type { InsightSection as InsightSectionData } from '@prism/shared'
import { renderMarkdown } from '../../chat/render-markdown'

interface InsightSectionProps {
  readonly data: InsightSectionData
  readonly onFollowUp?: (query: string) => void
}

function iconClass(icon: string): string {
  switch (icon) {
    case 'tip': return 'sr__insight--tip'
    case 'warning': return 'sr__insight--warning'
    case 'info': return 'sr__insight--info'
    case 'positive': return 'sr__insight--positive'
    default: return 'sr__insight--info'
  }
}

function iconEmoji(icon: string): string {
  switch (icon) {
    case 'tip': return '\u{1F4A1}'
    case 'warning': return '\u{1F4AC}' // 💬 speech bubble — informational, not alarming
    case 'info': return '\u2139\uFE0F'
    case 'positive': return '\u2705'
    default: return '\u2139\uFE0F'
  }
}

export function InsightSection({ data, onFollowUp }: InsightSectionProps) {
  // Use explicit action fields if provided, otherwise auto-generate from title
  const actionLabel = data.actionLabel ?? (data.title && onFollowUp ? 'Tell me more' : undefined)
  const actionPrompt = data.actionPrompt ?? (data.title ? `Tell me more about: ${data.title}` : undefined)

  return (
    <div className={`sr__insight ${iconClass(data.icon)}`}>
      <div className="sr__insight-header">
        <span className="sr__insight-icon" aria-hidden="true">{iconEmoji(data.icon)}</span>
        {data.title && <span className="sr__insight-title">{data.title}</span>}
      </div>
      <div className="sr__insight-body">{renderMarkdown(data.body)}</div>
      {actionLabel && actionPrompt && onFollowUp && (
        <button
          className="sr__insight-action"
          onClick={() => onFollowUp(actionPrompt)}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
