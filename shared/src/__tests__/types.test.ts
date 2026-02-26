import { describe, it, expect } from 'vitest'
import {
  HoldingSchema,
  PortfolioSchema,
  CausalChainSchema,
  SignalSchema,
  UserProfileSchema,
  FundCompositionSchema,
  ExposureMapSchema,
  StrategyDraftSchema,
  StrategyEvaluateRequestSchema,
  StrategyEvaluationSchema,
} from '../index'

describe('Shared Type Schemas', () => {
  it('validates a valid Holding', () => {
    const holding = {
      ticker: 'VFV',
      name: 'Vanguard S&P 500 Index ETF',
      type: 'ETF',
      valueCad: 14200,
      units: 120,
      accountType: 'TFSA',
      dataAsOf: '2026-02-24T00:00:00Z',
    }
    expect(HoldingSchema.parse(holding)).toEqual(holding)
  })

  it('rejects a Holding with negative value', () => {
    const bad = {
      ticker: 'VFV',
      name: 'Test',
      type: 'ETF',
      valueCad: -100,
      units: 10,
      accountType: 'TFSA',
      dataAsOf: '2026-02-24T00:00:00Z',
    }
    expect(() => HoldingSchema.parse(bad)).toThrow()
  })

  it('validates a Portfolio', () => {
    const portfolio = {
      userId: 'sarah-01',
      accounts: [
        {
          id: 'tfsa-01',
          type: 'TFSA',
          holdings: [
            {
              ticker: 'VFV',
              name: 'Vanguard S&P 500',
              type: 'ETF',
              valueCad: 14200,
              units: 120,
              accountType: 'TFSA',
              dataAsOf: '2026-02-24T00:00:00Z',
            },
          ],
        },
      ],
      totalValueCad: 14200,
      lastUpdated: '2026-02-24T00:00:00Z',
    }
    expect(PortfolioSchema.parse(portfolio)).toBeTruthy()
  })

  it('validates a CausalChain', () => {
    const chain = {
      id: 'chain-01',
      signalId: 'signal-01',
      generatedAt: '2026-02-24T12:00:00Z',
      nodes: [
        {
          id: 'n1',
          type: 'event',
          label: 'BoC Rate Hold',
          description: 'Bank of Canada holds rate at 2.25%',
          confidence: 0.9,
          metadata: {},
        },
        {
          id: 'n2',
          type: 'mechanism',
          label: 'Net Interest Margin Impact',
          description: 'Higher rates support bank margins',
          confidence: 0.8,
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          magnitude: 0.7,
          direction: 'positive',
          confidence: 0.85,
          mechanism: 'Rate hold supports net interest margins for banks',
        },
      ],
      summary: 'BoC rate hold impacts Canadian financials through margin effects',
      disclaimer: 'For informational purposes only.',
      maxHops: 2,
      isSpeculative: false,
    }
    expect(CausalChainSchema.parse(chain)).toBeTruthy()
  })

  it('validates a Signal', () => {
    const signal = {
      id: 'sig-01',
      headline: 'BoC Holds Rate at 2.25%',
      description: 'The Bank of Canada held its key rate steady',
      affectedExposures: ['Canadian Financials'],
      relevanceScore: 0.9,
      urgency: 'high',
      temporalClassification: 'structural',
      sources: [
        {
          title: 'BoC Rate Decision',
          url: 'https://example.com/boc',
        },
      ],
      detectedAt: '2026-02-24T14:00:00Z',
      acknowledged: false,
    }
    expect(SignalSchema.parse(signal)).toBeTruthy()
  })

  it('validates a UserProfile', () => {
    const profile = {
      id: 'sarah-01',
      name: 'Sarah',
      age: 42,
      riskTolerance: 'moderate',
      financialLiteracy: 'moderate',
      goals: ['Retirement at 62', "Children's education fund"],
      investmentHorizonYears: 20,
      context: 'Bought ETFs based on couch potato recommendations',
      preferences: {
        maxDailyAlerts: 2,
        detailLevel: 'moderate',
      },
    }
    expect(UserProfileSchema.parse(profile)).toBeTruthy()
  })

  it('validates a FundComposition', () => {
    const fund = {
      ticker: 'VFV',
      name: 'Vanguard S&P 500 Index ETF',
      provider: 'Vanguard Canada',
      assetClass: 'equity',
      market: 'US',
      holdings: [
        { name: 'Apple Inc.', ticker: 'AAPL', weight: 7.1, sector: 'Technology', country: 'US' },
        {
          name: 'Microsoft Corp.',
          ticker: 'MSFT',
          weight: 6.5,
          sector: 'Technology',
          country: 'US',
        },
      ],
      coveragePercent: 13.6,
      dataSource: 'Vanguard Canada Fund Facts Feb 2026',
      dataAsOf: '2026-02-24',
      refreshFrequency: 'daily',
    }
    expect(FundCompositionSchema.parse(fund)).toBeTruthy()
  })

  it('validates an ExposureMap', () => {
    const map = {
      portfolioId: 'sarah-01',
      generatedAt: '2026-02-24T12:00:00Z',
      exposures: [
        {
          category: 'Canadian Financials',
          percentage: 38,
          valueCad: 15200,
          contributingHoldings: [
            { ticker: 'XIC', contribution: 22 },
            { ticker: 'ZEB', contribution: 16 },
          ],
        },
      ],
      overlaps: [
        {
          assetName: 'Royal Bank of Canada',
          assetTicker: 'RY',
          totalPercentage: 6.8,
          sources: [
            { fundTicker: 'XIC', weightInFund: 5.2 },
            { fundTicker: 'ZEB', weightInFund: 16.7 },
          ],
        },
      ],
      warnings: [
        {
          category: 'Canadian Financials',
          percentage: 38,
          severity: 'high',
          message: 'Canadian Financials concentration at 38% exceeds 30% threshold',
        },
      ],
      dataFreshness: {
        allFresh: true,
        staleFunds: [],
      },
    }
    expect(ExposureMapSchema.parse(map)).toBeTruthy()
  })

  it('validates a StrategyDraft', () => {
    const draft = {
      signalId: 'sig-01',
      signalHeadline: 'BoC Holds Rate at 2.25%',
      generatedAt: '2026-02-26T10:00:00Z',
      objective: 'minimize_one_month_downside_with_six_month_guardrail',
      constraints: {
        turnoverCapPct: 5,
        hardMaxTurnoverPct: 10,
        allowCashBuffer: true,
        taxAware: true,
        noMicrocaps: true,
        excludeLeveragedEtfs: true,
        maxNewPositions: 2,
      },
      candidates: [
        {
          id: 'cand-zag',
          ticker: 'ZAG',
          name: 'BMO Aggregate Bond Index ETF',
          type: 'etf',
          rationale: 'Diversifies rate-sensitive downside.',
          confidence: 0.78,
          expectedMitigationCad: 180,
          proposedShiftPct: 1.2,
          diversificationScore: 0.85,
          estimatedTurnoverCostCad: 14,
          estimatedTaxCostCad: 10,
          isLargeCapProxy: false,
          liquidityTier: 'high',
          rankScore: 102.4,
        },
      ],
      scenario: {
        items: [
          {
            candidateId: 'cand-zag',
            ticker: 'ZAG',
            name: 'BMO Aggregate Bond Index ETF',
            type: 'etf',
            rationale: 'Diversifies rate-sensitive downside.',
            confidence: 0.78,
            expectedMitigationCad: 180,
            diversificationScore: 0.85,
            estimatedTurnoverCostCad: 14,
            estimatedTaxCostCad: 10,
            allocationPct: 1.2,
          },
        ],
      },
      baselineOneMonthCad: -1250,
      baselineSixMonthCad: -600,
      seedSummary: 'Build mitigation draft',
      humanDecisionRequired: true,
    }
    expect(StrategyDraftSchema.parse(draft)).toBeTruthy()
  })

  it('validates StrategyEvaluateRequest', () => {
    const req = {
      signalId: 'sig-01',
      scenario: {
        items: [
          {
            candidateId: 'cand-zag',
            ticker: 'ZAG',
            name: 'BMO Aggregate Bond Index ETF',
            type: 'etf',
            rationale: 'Diversifies rate-sensitive downside.',
            confidence: 0.78,
            expectedMitigationCad: 180,
            diversificationScore: 0.85,
            estimatedTurnoverCostCad: 14,
            estimatedTaxCostCad: 10,
            allocationPct: 1.2,
          },
        ],
      },
      explicitOverride: false,
    }
    expect(StrategyEvaluateRequestSchema.parse(req)).toBeTruthy()
  })

  it('validates StrategyEvaluation', () => {
    const evaluation = {
      generatedAt: '2026-02-26T10:00:00Z',
      objective: 'minimize_one_month_downside_with_six_month_guardrail',
      baselineOneMonthCad: -1250,
      proposedOneMonthCad: -820,
      baselineSixMonthCad: -600,
      proposedSixMonthCad: -420,
      downsideReductionCad: 430,
      sixMonthGuardrailDeltaCad: 180,
      diversificationGain: 1.4,
      turnoverPct: 2.4,
      turnoverCapPct: 5,
      taxPenaltyCad: 18,
      score: 168.2,
      objectiveSatisfied: true,
      warnings: [],
      humanDecisionRequired: true,
    }
    expect(StrategyEvaluationSchema.parse(evaluation)).toBeTruthy()
  })
})
