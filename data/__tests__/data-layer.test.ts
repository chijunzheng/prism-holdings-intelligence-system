import { describe, it, expect } from 'vitest'
import {
  getPortfolios,
  getPortfolioByUserId,
  getFundComposition,
  getAllFundCompositions,
  getUserProfiles,
  getUserProfileById,
} from '../index'

describe('Data Layer', () => {
  describe('Portfolios', () => {
    it('loads all 6 portfolios with valid schemas', () => {
      const portfolios = getPortfolios()
      expect(portfolios).toHaveLength(6)
    })

    it('primary portfolio has correct total value', () => {
      const sarah = getPortfolioByUserId('sarah-01')
      expect(sarah).toBeDefined()
      expect(sarah!.totalValueCad).toBe(40000)
    })

    it('primary portfolio has 6 holdings across 4 accounts', () => {
      const sarah = getPortfolioByUserId('sarah-01')!
      expect(sarah.accounts).toHaveLength(4)
      const totalHoldings = sarah.accounts.reduce((sum, a) => sum + a.holdings.length, 0)
      expect(totalHoldings).toBe(6)
    })

    it('primary portfolio holding values sum to total', () => {
      const sarah = getPortfolioByUserId('sarah-01')!
      const holdingSum = sarah.accounts.reduce(
        (sum, a) => sum + a.holdings.reduce((s, h) => s + h.valueCad, 0),
        0,
      )
      expect(holdingSum).toBe(sarah.totalValueCad)
    })
  })

  describe('Fund Compositions', () => {
    it('loads all 13 fund compositions', () => {
      const funds = getAllFundCompositions()
      expect(funds.size).toBe(13)
    })

    it('VFV has top holdings with Apple as largest', () => {
      const vfv = getFundComposition('VFV')
      expect(vfv).toBeDefined()
      expect(vfv!.holdings[0].name).toBe('Apple Inc.')
    })

    it('ZEB weights sum to ~100% (equal weight banks)', () => {
      const zeb = getFundComposition('ZEB')!
      const totalWeight = zeb.holdings.reduce((sum, h) => sum + h.weight, 0)
      expect(totalWeight).toBeGreaterThan(99)
      expect(totalWeight).toBeLessThanOrEqual(100)
    })

    it('fund weights do not exceed 100%', () => {
      const funds = getAllFundCompositions()
      for (const [ticker, fund] of funds) {
        const total = fund.holdings.reduce((sum, h) => sum + h.weight, 0)
        expect(total).toBeLessThanOrEqual(100.1) // small float tolerance
      }
    })

    it('Royal Bank appears in both XIC and ZEB (overlap detection)', () => {
      const xic = getFundComposition('XIC')!
      const zeb = getFundComposition('ZEB')!
      const ryInXic = xic.holdings.find((h) => h.ticker === 'RY')
      const ryInZeb = zeb.holdings.find((h) => h.ticker === 'RY')
      expect(ryInXic).toBeDefined()
      expect(ryInZeb).toBeDefined()
    })

    it('Canadian Natural Resources appears in both XIC and XEG (overlap)', () => {
      const xic = getFundComposition('XIC')!
      const xeg = getFundComposition('XEG')!
      const cnqInXic = xic.holdings.find((h) => h.ticker === 'CNQ')
      const cnqInXeg = xeg.holdings.find((h) => h.ticker === 'CNQ')
      expect(cnqInXic).toBeDefined()
      expect(cnqInXeg).toBeDefined()
    })
  })

  describe('User Profiles', () => {
    it('loads all 6 user profiles', () => {
      const profiles = getUserProfiles()
      expect(profiles).toHaveLength(6)
    })

    it('Sarah is the primary demo user (mid-career, moderate risk)', () => {
      const sarah = getUserProfileById('sarah-01')
      expect(sarah).toBeDefined()
      expect(sarah!.age).toBe(42)
      expect(sarah!.riskTolerance).toBe('moderate')
    })

    it('Marcus is young and high risk tolerance', () => {
      const marcus = getUserProfileById('marcus-01')
      expect(marcus).toBeDefined()
      expect(marcus!.age).toBe(25)
      expect(marcus!.riskTolerance).toBe('high')
    })

    it('Diana is pre-retiree with low risk tolerance', () => {
      const diana = getUserProfileById('diana-01')
      expect(diana).toBeDefined()
      expect(diana!.age).toBe(58)
      expect(diana!.riskTolerance).toBe('low')
    })
  })
})
