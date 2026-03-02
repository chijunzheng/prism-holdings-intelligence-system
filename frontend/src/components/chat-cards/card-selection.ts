// card-selection.ts — inspects pipeline output and decides which cards to show.
// Replaces the unconditional card insertion with context-aware selection.

import type { AnalysisCompleteData } from './types'

export interface CardSelection {
  readonly showVerdictSummary: boolean
  readonly showImpactDelta: boolean
  readonly showDebate: boolean
  readonly promoteDebate: boolean
  readonly showPlaybook: boolean
  readonly showRecommendations: boolean
  readonly showTransparencyBar: boolean
  // Always false — these moved out of the chat stream
  readonly showReasoningInStream: false
  readonly showResearchBriefInline: false
}

export function selectPipelineCards(payload: AnalysisCompleteData): CardSelection {
  const verdict = payload.verdict
  if (!verdict) {
    return {
      showVerdictSummary: false,
      showImpactDelta: false,
      showDebate: false,
      promoteDebate: false,
      showPlaybook: false,
      showRecommendations: false,
      showTransparencyBar: false,
      showReasoningInStream: false,
      showResearchBriefInline: false,
    }
  }

  const netImpact = verdict.holdingImpacts
    .map((h) => h.impact['1M']?.mid ?? 0)
    .reduce((sum, v) => sum + v, 0)

  const unresolvedCount = verdict.perspectiveBreakdown.unresolvedDisagreements.length
  const recommendations = verdict.recommendations
  const onlyDoNothing = recommendations.length === 1 && recommendations[0].isDoNothing

  return {
    showVerdictSummary: true,
    showImpactDelta: true,
    // Skip full playbook when net impact < $50
    showPlaybook: Math.abs(netImpact) >= 50 && !onlyDoNothing,
    // Promote debate above recommendations when there are unresolved disagreements
    showDebate: Boolean(payload.intermediateArtifacts?.debateResolution),
    promoteDebate: unresolvedCount > 0,
    showRecommendations: recommendations.length > 0,
    showTransparencyBar: true,
    // These always stay out of the stream
    showReasoningInStream: false,
    showResearchBriefInline: false,
  }
}
