// Sentiment Analyst — market sentiment, momentum, positioning, is-it-priced-in
// Focuses on sentiment indicators and pricing-in evaluation.

import type {
  AnalystAssessment,
  Signal,
  Portfolio,
  ExposureMap,
  InferredRiskProfile,
} from '@prism/shared'
import { runAnalyst } from './run-analyst.js'

export async function runSentimentAnalyst(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly riskProfile: InferredRiskProfile
}): Promise<AnalystAssessment> {
  return runAnalyst({ ...params, analystType: 'sentiment' })
}
