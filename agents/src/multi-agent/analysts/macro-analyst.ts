// Macro Analyst — monetary policy, fiscal, trade flows, currency, sovereign risk
// Focuses on sector-level directional impact and magnitude assessment.

import type {
  AnalystAssessment,
  Signal,
  Portfolio,
  ExposureMap,
  InferredRiskProfile,
} from '@prism/shared'
import { runAnalyst } from './run-analyst.js'

export async function runMacroAnalyst(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly riskProfile: InferredRiskProfile
}): Promise<AnalystAssessment> {
  return runAnalyst({ ...params, analystType: 'macro' })
}
