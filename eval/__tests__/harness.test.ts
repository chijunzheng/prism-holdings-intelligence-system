import { describe, it, expect } from 'vitest'
import { getPortfolioByUserId } from '@prism/data'
import { ExposureMapSchema } from '@prism/shared'
import { buildSimpleExposureMap } from '../exposure-map'

describe('buildSimpleExposureMap', () => {
  it('builds a schema-valid ExposureMap for demo portfolios', () => {
    const portfolio = getPortfolioByUserId('sarah-01')
    expect(portfolio).toBeDefined()

    const exposureMap = buildSimpleExposureMap(portfolio!)
    const parsed = ExposureMapSchema.parse(exposureMap)

    expect(parsed.portfolioId).toBe('sarah-01')
    expect(parsed.exposures.length).toBeGreaterThan(0)
    expect(parsed.overlaps).toEqual([])
    expect(parsed.warnings).toEqual([])
  })
})
