// TransparencyBar — compact single-line summary that replaces reasoning trace in the chat stream.
// Shows agent count, debate rounds, quality score, and a "View Reasoning" link.

import type { TransparencyBarData } from './types'

interface TransparencyBarProps {
  readonly data: TransparencyBarData
  readonly onViewReasoning?: () => void
}

export function TransparencyBar({ data, onViewReasoning }: TransparencyBarProps) {
  return (
    <div className="chat-card chat-card--compact transparency-bar">
      <span className="transparency-bar__diamond">&#9670;</span>
      <span className="transparency-bar__stat">
        Analyzed by {data.agentCount} agents
      </span>
      <span className="transparency-bar__divider">|</span>
      <span className="transparency-bar__stat">
        {data.debateRounds}-round debate
      </span>
      <span className="transparency-bar__divider">|</span>
      <span className="transparency-bar__stat">
        Quality: {Math.round(data.qualityScore * 100)}%
      </span>
      {onViewReasoning && (
        <>
          <span className="transparency-bar__divider">|</span>
          <button
            type="button"
            className="transparency-bar__link"
            onClick={onViewReasoning}
          >
            View Reasoning &rarr;
          </button>
        </>
      )}
    </div>
  )
}
