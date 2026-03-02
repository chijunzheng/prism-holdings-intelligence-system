// ThinkingCard — shows real-time thinking/reasoning progress.
// Used for both pipeline agent stages and chat route thinking tokens.

import { useEffect, useRef } from 'react'
import { renderMarkdown } from '../chat/render-markdown'

interface ThinkingData {
  readonly stage: string
  readonly agentName?: string
  readonly message?: string
  readonly isComplete?: boolean
}

interface ThinkingCardProps {
  readonly data: unknown
}

const STAGE_ICONS: Record<string, string> = {
  routing: 'Thinking',
  thinking: 'Thinking',
  risk_profile: 'Inferring risk profile',
  market_data: 'Fetching market data',
  analyst_complete: 'Analyst assessment complete',
  debate_round: 'Debate in progress',
  debate_complete: 'Debate resolved',
  risk_challenge: 'Challenging assumptions',
  magnitude_validation: 'Validating magnitudes',
  stress_complete: 'Stress test complete',
  verdict: 'Fund manager synthesizing',
  judge: 'Quality evaluation',
  brief: 'Generating research brief',
}

export function ThinkingCard({ data }: ThinkingCardProps) {
  const thinking = data as ThinkingData
  const detailRef = useRef<HTMLDivElement>(null)

  const label = STAGE_ICONS[thinking.stage] ?? thinking.stage
  const isComplete = thinking.isComplete ?? false

  // Auto-scroll to bottom as thinking tokens stream in
  useEffect(() => {
    if (detailRef.current) {
      detailRef.current.scrollTop = detailRef.current.scrollHeight
    }
  }, [thinking.message])

  return (
    <div className="chat-card chat-card--thinking">
      <div className="chat-card__thinking-indicator">
        {isComplete ? (
          <span className="chat-card__check">&#10003;</span>
        ) : (
          <span className="chat-card__spinner" />
        )}
        <span className="chat-card__stage-label">{label}</span>
      </div>
      {thinking.message && thinking.message !== 'Prism is thinking...' && (
        <div
          ref={detailRef}
          className="chat-card__thinking-detail chat-card__thinking-detail--streaming"
        >
          {renderMarkdown(thinking.message)}
        </div>
      )}
    </div>
  )
}
