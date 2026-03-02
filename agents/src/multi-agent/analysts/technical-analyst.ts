// Technical Analyst — support/resistance, trend, historical vol, price ranges
// Uses REAL volatility data from Market Data Service — does not guess.

import type {
  AnalystAssessment,
  Signal,
  Portfolio,
  ExposureMap,
  InferredRiskProfile,
  MarketDataBundle,
} from '@prism/shared'
import { runAnalyst } from './run-analyst.js'

export async function runTechnicalAnalyst(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly riskProfile: InferredRiskProfile
  readonly marketData: MarketDataBundle
}): Promise<AnalystAssessment> {
  return runAnalyst({ ...params, analystType: 'technical' })
}
