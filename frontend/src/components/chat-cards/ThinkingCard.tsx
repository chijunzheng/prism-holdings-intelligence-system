// ThinkingCard — shows real-time pipeline progress per agent stage.

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

  const label = STAGE_ICONS[thinking.stage] ?? thinking.stage
  const isComplete = thinking.isComplete ?? false

  return (
    <div className={`chat-card chat-card--thinking ${isComplete ? 'chat-card--thinking-complete' : ''}`}>
      <div className="chat-card__thinking-indicator">
        {isComplete ? (
          <span className="chat-card__check">&#10003;</span>
        ) : (
          <span className="chat-card__spinner" />
        )}
        <span className="chat-card__stage-label">{label}</span>
      </div>
      {thinking.message && (
        <p className="chat-card__thinking-detail">{thinking.message}</p>
      )}
    </div>
  )
}
