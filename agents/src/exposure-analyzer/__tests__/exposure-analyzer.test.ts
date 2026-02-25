import { describe, it, expect } from 'vitest'
import { analyze } from '../index'
import { getPortfolioByUserId, getFundComposition } from '../../../../data/index'

describe('Exposure Analyzer', () => {
  describe('Primary demo portfolio (Sarah)', () => {
    it('successfully analyzes the portfolio', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('does not emit opaque diversified-holdings categories', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      const hasOpaqueBucket = result.data!.exposures.some((e) =>
        e.category.includes('Diversified Holdings'),
      )
      expect(hasOpaqueBucket).toBe(false)
    })

    it('produces Canadian Financials as largest sector concentration', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      const financials = result.data!.exposures.find((e) =>
        e.category.includes('Canadian Financials'),
      )
      expect(financials).toBeDefined()
      // Top-holdings-only decomposition: XIC top 25 + ZEB full = ~17%
      // Full decomposition would yield ~38% but we only have top-N data
      expect(financials!.percentage).toBeGreaterThan(15)
    })

    it('detects US Technology concentration', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      const tech = result.data!.exposures.find((e) => e.category.includes('US Technology'))
      expect(tech).toBeDefined()
      expect(tech!.percentage).toBeGreaterThan(10)
    })

    it('detects Canadian Energy concentration', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      const energy = result.data!.exposures.find((e) => e.category.includes('Canadian Energy'))
      expect(energy).toBeDefined()
      expect(energy!.percentage).toBeGreaterThan(8)
    })

    it('finds Royal Bank overlap between XIC and ZEB', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      const ryOverlap = result.data!.overlaps.find((o) => o.assetTicker === 'RY')
      expect(ryOverlap).toBeDefined()
      expect(ryOverlap!.sources.length).toBeGreaterThanOrEqual(2)
    })

    it('finds TD Bank overlap between XIC and ZEB', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      const tdOverlap = result.data!.overlaps.find((o) => o.assetTicker === 'TD')
      expect(tdOverlap).toBeDefined()
      expect(tdOverlap!.sources.length).toBeGreaterThanOrEqual(2)
    })

    it('finds CNRL overlap between XIC and XEG', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      const cnqOverlap = result.data!.overlaps.find((o) => o.assetTicker === 'CNQ')
      expect(cnqOverlap).toBeDefined()
      expect(cnqOverlap!.sources.length).toBeGreaterThanOrEqual(2)
    })

    it('generates concentration warnings for material concentration categories', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      expect(result.data!.warnings.length).toBeGreaterThan(0)
      const materialWarnings = result.data!.warnings.filter(
        (w) => w.severity === 'critical' || w.severity === 'high' || w.severity === 'medium',
      )
      expect(materialWarnings.length).toBeGreaterThan(0)
    })

    it('reports all fund data as fresh', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      expect(result.data!.dataFreshness.allFresh).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('handles missing fund composition gracefully', async () => {
      const portfolio = getPortfolioByUserId('marcus-01')!
      // Marcus has SHOP as individual stock — no fund composition needed
      const result = await analyze(portfolio, getFundComposition)
      expect(result.success).toBe(true)
    })

    it('exposure percentages sum to approximately 100%', async () => {
      const portfolio = getPortfolioByUserId('sarah-01')!
      const result = await analyze(portfolio, getFundComposition)
      const totalPercent = result.data!.exposures.reduce((sum, e) => sum + e.percentage, 0)
      expect(totalPercent).toBeGreaterThan(95)
      expect(totalPercent).toBeLessThan(105)
    })
  })
})
