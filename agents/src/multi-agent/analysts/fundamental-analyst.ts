// Fundamental Analyst — earnings, valuation, business model impact
// Focuses on holding-level earnings and valuation effects.

import type {
  AnalystAssessment,
  Signal,
  Portfolio,
  ExposureMap,
  InferredRiskProfile,
} from '@prism/shared'
import { runAnalyst } from './run-analyst.js'

export async function runFundamentalAnalyst(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly riskProfile: InferredRiskProfile
}): Promise<AnalystAssessment> {
  return runAnalyst({ ...params, analystType: 'fundamental' })
}
