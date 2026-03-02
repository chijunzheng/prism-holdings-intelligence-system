// stage-actions — maps pipeline stage IDs to ActionCenterMode.
// Shared between AgentProgressLine (inline progress) and ChatArea (stage summary lines).

import type { ActionCenterMode, AgentProgressGroupData } from './types'
import type { InferredRiskProfile, MarketDataBundle, ResearchBrief } from '@prism/shared'

export type IntermediateArtifacts = AgentProgressGroupData['intermediateArtifacts'] & {
  readonly riskProfile?: InferredRiskProfile
  readonly marketData?: MarketDataBundle
  readonly researchBrief?: ResearchBrief
}

/** Map a completed stage ID → the ActionCenterMode to open when the user clicks "View details" */
export function getStageDrawerAction(
  stageId: string,
  stageLabel: string,
  summary: string,
  artifacts: IntermediateArtifacts | undefined,
): ActionCenterMode {
  if (artifacts) {
    switch (stageId) {
      case 'risk_profile':
        if (artifacts.riskProfile) {
          return { mode: 'risk_profile_detail', riskProfile: artifacts.riskProfile }
        }
        break
      case 'market_data':
        if (artifacts.marketData) {
          return { mode: 'market_data_detail', marketData: artifacts.marketData }
        }
        break
      case 'analyst_complete':
        if (artifacts.analystAssessments && artifacts.analystAssessments.length > 0) {
          return { mode: 'analyst_picker', assessments: artifacts.analystAssessments }
        }
        break
      case 'debate_complete':
        if (artifacts.debateResolution) {
          return { mode: 'debate_transcript', debate: artifacts.debateResolution }
        }
        break
      case 'risk_challenge':
        if (artifacts.riskChallenge) {
          return { mode: 'assumption_challenges', riskChallenge: artifacts.riskChallenge }
        }
        break
      case 'magnitude_validation':
        if (artifacts.magnitudeValidation) {
          return { mode: 'magnitude_detail', magnitudeValidation: artifacts.magnitudeValidation }
        }
        break
      case 'stress_complete':
        if (artifacts.stressTest) {
          return { mode: 'stress_detail', stressTest: artifacts.stressTest }
        }
        break
      case 'brief':
        if (artifacts.researchBrief) {
          return { mode: 'research_brief', brief: artifacts.researchBrief }
        }
        break
    }
  }

  // Fallback: all stages are clickable via the generic summary detail view
  return { mode: 'stage_summary_detail', stageLabel, summary }
}
