import { describe, it, expect } from 'vitest'
import { getPortfolioByUserId } from '@prism/data'
import { buildSimpleExposureMap } from '../exposure-map'
import { formatExposureSummary } from '../baselines/exposure-summary'

describe('formatExposureSummary', () => {
  it('formats category-to-ticker lines from ExposureMap.exposures', () => {
    const portfolio = getPortfolioByUserId('sarah-01')
    expect(portfolio).toBeDefined()

    const exposureMap = buildSimpleExposureMap(portfolio!)
    const summary = formatExposureSummary(exposureMap)

    expect(summary).toContain('US Equity')
    expect(summary).toContain('VFV')
    expect(summary.split('\n').length).toBeGreaterThan(1)
  })
})
