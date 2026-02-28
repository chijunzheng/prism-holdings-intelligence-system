// ChatCardRenderer — dispatcher that renders the right card type.
// Receives a generic { type, data } and routes to the correct component.

import { SignalCard } from './SignalCard'
import { ThinkingCard } from './ThinkingCard'
import { PipelineProgressCard } from './PipelineProgressCard'
import { DebateSummaryCard } from './DebateSummaryCard'
import { CheckpointCard } from './CheckpointCard'
import { StressScenarioCard } from './StressScenarioCard'
import { RecommendationCard } from './RecommendationCard'
import { TransparencyCard } from './TransparencyCard'
import { PortfolioReviewCard } from './PortfolioReviewCard'
import { ResearchBriefCard } from './ResearchBriefCard'

type ChatCard = {
  readonly type: string
  readonly data: unknown
}

interface ChatCardRendererProps {
  readonly card: ChatCard
  readonly onCheckpointSubmit?: (value: string) => void
  readonly onRecommendationSelect?: (id: string) => void
  readonly onSignalAnalyze?: (signalId: string) => void
}

export function ChatCardRenderer({ card, onCheckpointSubmit, onRecommendationSelect, onSignalAnalyze }: ChatCardRendererProps) {
  switch (card.type) {
    case 'signal':
      return <SignalCard data={card.data} onAnalyze={onSignalAnalyze} />
    case 'thinking':
      return <ThinkingCard data={card.data} />
    case 'pipeline_progress':
      return <PipelineProgressCard data={card.data} />
    case 'debate_summary':
      return <DebateSummaryCard data={card.data} />
    case 'checkpoint':
      return <CheckpointCard data={card.data} onSubmit={onCheckpointSubmit} />
    case 'stress_scenario':
      return <StressScenarioCard data={card.data} onSelect={onCheckpointSubmit} />
    case 'recommendation':
      return <RecommendationCard data={card.data} onSelect={onRecommendationSelect} />
    case 'transparency':
      return <TransparencyCard data={card.data} />
    case 'portfolio_review':
      return <PortfolioReviewCard data={card.data} />
    case 'research_brief':
      return <ResearchBriefCard data={card.data} />
    default:
      return (
        <div className="chat-card chat-card--unknown">
          <p>Unknown card type: {card.type}</p>
        </div>
      )
  }
}
