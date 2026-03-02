// ChatCardRenderer — dispatcher that renders the right card type.
// Receives a generic { type, data } and routes to the correct component.
// Threads onFollowUp and onActionCenterMode to all interactive pipeline cards.

import { SignalCard } from './SignalCard'
import { ThinkingCard } from './ThinkingCard'
import { PipelineProgressCard } from './PipelineProgressCard'
import { DebateSummaryCard } from './DebateSummaryCard'
import { CheckpointCard } from './CheckpointCard'
import { RecommendationCard } from './RecommendationCard'
import { TransparencyCard } from './TransparencyCard'
import { PortfolioReviewCard } from './PortfolioReviewCard'
import { ResearchBriefCard } from './ResearchBriefCard'
import { SignalImpactDeltaCard } from './SignalImpactDeltaCard'
import { ActionPlaybookCard } from './ActionPlaybookCard'
import { TraceNavigatorCard } from './TraceNavigatorCard'
import { ReasoningTraceCard } from './ReasoningTraceCard'
import { PlanPreviewCard } from './PlanPreviewCard'
import { StructuredResponseCard } from './structured-response/StructuredResponseCard'
import { TransparencyBar } from './TransparencyBar'
import { VerdictSummaryCard } from './VerdictSummaryCard'
import { SoftCheckpointCard } from './SoftCheckpointCard'
import { AgentProgressGroup } from './AgentProgressGroup'
import { AnalysisReportCard } from './AnalysisReportCard'
import { SignalUpdateCard } from './SignalUpdateCard'
import type { ActionCenterMode, ChatCard } from './types'

interface ChatCardRendererProps {
  readonly card: ChatCard
  readonly onCheckpointSubmit?: (value: string) => void
  readonly onRecommendationSelect?: (id: string) => void
  readonly onSavePlan?: (id: string) => void
  readonly onSignalAnalyze?: (signalId: string) => void
  readonly onFollowUp?: (query: string) => void
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

export function ChatCardRenderer({
  card,
  onCheckpointSubmit,
  onRecommendationSelect,
  onSavePlan,
  onSignalAnalyze,
  onFollowUp,
  onActionCenterMode,
}: ChatCardRendererProps) {
  switch (card.type) {
    case 'signal':
      return <SignalCard data={card.data} onAnalyze={onSignalAnalyze} />
    case 'thinking':
      return <ThinkingCard data={card.data} />
    case 'pipeline_progress':
      return <PipelineProgressCard data={card.data} />
    case 'debate_summary':
      return (
        <DebateSummaryCard
          data={card.data}
          onActionCenterMode={onActionCenterMode}
        />
      )
    case 'checkpoint':
      return <CheckpointCard data={card.data} onSubmit={onCheckpointSubmit} />
    case 'recommendation':
      return (
        <RecommendationCard
          data={card.data}
          onSelect={onRecommendationSelect}
          onSavePlan={onSavePlan}
          onFollowUp={onFollowUp}
          onActionCenterMode={onActionCenterMode}
        />
      )
    case 'transparency':
      return <TransparencyCard data={card.data} />
    case 'portfolio_review':
      return <PortfolioReviewCard data={card.data} />
    case 'research_brief':
      return (
        <ResearchBriefCard
          data={card.data}
          onActionCenterMode={onActionCenterMode}
        />
      )
    case 'signal_impact_delta':
      return (
        <SignalImpactDeltaCard
          data={card.data}
          onFollowUp={onFollowUp}
          onActionCenterMode={onActionCenterMode}
        />
      )
    case 'action_playbook':
      return <ActionPlaybookCard data={card.data} onSelect={onRecommendationSelect} onSavePlan={onSavePlan} />
    case 'trace_navigator':
      return <TraceNavigatorCard data={card.data} />
    case 'reasoning_trace':
      return <ReasoningTraceCard data={card.data} />
    case 'plan_preview':
      return <PlanPreviewCard data={card.data} />
    case 'structured_response':
      return <StructuredResponseCard data={card.data} onFollowUp={onFollowUp} />
    case 'transparency_bar':
      return (
        <TransparencyBar
          data={card.data}
          onViewReasoning={() => {
            onActionCenterMode?.({
              mode: 'reasoning_trace',
              trace: card.data.reasoningTrace,
            })
          }}
        />
      )
    case 'verdict_summary':
      return <VerdictSummaryCard data={card.data} onFollowUp={onFollowUp} />
    case 'soft_checkpoint':
      return <SoftCheckpointCard data={card.data} onSubmit={onCheckpointSubmit} onActionCenterMode={onActionCenterMode} />
    case 'agent_progress_group':
      return <AgentProgressGroup data={card.data} onActionCenterMode={onActionCenterMode} />
    case 'analysis_report':
      return (
        <AnalysisReportCard
          data={card.data}
          onFollowUp={onFollowUp}
          onSavePlan={onSavePlan}
          onActionCenterMode={onActionCenterMode}
        />
      )
    case 'signal_update':
      return <SignalUpdateCard data={card.data} onFollowUp={onFollowUp} />
    default:
      return (
        <div className="chat-card chat-card--unknown">
          <p>Unknown card type</p>
        </div>
      )
  }
}
