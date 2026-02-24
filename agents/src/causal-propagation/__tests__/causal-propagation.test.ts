import { describe, it, expect } from 'vitest'
import { buildCausalChainPrompt } from '../prompts'
import { validateCausalChain } from '../validate'
import type { Signal, ExposureMap } from '@prism/shared'

const sampleSignal: Signal = {
  id: 'sig-boc-rate',
  headline: 'BoC Holds Rate at 2.25%',
  description: 'The Bank of Canada held its key interest rate at 2.25%.',
  affectedExposures: ['Canadian Financials'],
  relevanceScore: 0.9,
  urgency: 'high',
  temporalClassification: 'structural',
  sources: [{ title: 'BoC', url: 'https://www.bankofcanada.ca/rate' }],
  detectedAt: '2026-02-24T14:00:00Z',
  acknowledged: false,
}

const sampleExposureMap: ExposureMap = {
  portfolioId: 'sarah-01',
  generatedAt: '2026-02-24T12:00:00Z',
  exposures: [
    {
      category: 'Canadian Financials',
      percentage: 17.1,
      valueCad: 6840,
      contributingHoldings: [
        { ticker: 'XIC', contribution: 6.5 },
        { ticker: 'ZEB', contribution: 10.5 },
      ],
    },
  ],
  overlaps: [
    {
      assetName: 'Royal Bank of Canada',
      assetTicker: 'RY',
      totalPercentage: 6.8,
      sources: [
        { fundTicker: 'XIC', weightInFund: 6.8 },
        { fundTicker: 'ZEB', weightInFund: 16.7 },
      ],
    },
  ],
  warnings: [],
  dataFreshness: { allFresh: true, staleFunds: [] },
}

describe('Causal Propagation Engine', () => {
  describe('Prompt construction', () => {
    it('includes signal headline and description', () => {
      const prompt = buildCausalChainPrompt(sampleSignal, sampleExposureMap)
      expect(prompt).toContain('BoC Holds Rate at 2.25%')
      expect(prompt).toContain('Bank of Canada')
    })

    it('includes exposure data', () => {
      const prompt = buildCausalChainPrompt(sampleSignal, sampleExposureMap)
      expect(prompt).toContain('Canadian Financials')
      expect(prompt).toContain('17.1%')
    })

    it('includes overlap information', () => {
      const prompt = buildCausalChainPrompt(sampleSignal, sampleExposureMap)
      expect(prompt).toContain('Royal Bank of Canada')
    })

    it('requires mechanism nodes between event and asset', () => {
      const prompt = buildCausalChainPrompt(sampleSignal, sampleExposureMap)
      expect(prompt).toContain('mechanism')
      expect(prompt).toContain('NEVER link an event directly to an asset')
    })
  })

  describe('Chain validation', () => {
    const validChain = {
      id: 'chain-01',
      signalId: 'sig-boc-rate',
      generatedAt: '2026-02-24T12:00:00Z',
      nodes: [
        {
          id: 'n1',
          type: 'event',
          label: 'BoC Rate Hold',
          description: 'Bank of Canada holds at 2.25%',
          confidence: 0.95,
          metadata: {},
        },
        {
          id: 'n2',
          type: 'mechanism',
          label: 'Net Interest Margin',
          description: 'Higher rates support bank lending margins',
          confidence: 0.85,
          metadata: {},
        },
        {
          id: 'n3',
          type: 'sector',
          label: 'Canadian Banks',
          description: 'Big 6 Canadian banks benefit',
          confidence: 0.8,
          metadata: {},
        },
        {
          id: 'n4',
          type: 'asset',
          label: 'ZEB',
          description: 'BMO Equal Weight Banks ETF gains',
          confidence: 0.75,
          dollarImpact: 120,
          percentageImpact: 2.8,
          metadata: {},
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          magnitude: 0.8,
          direction: 'positive',
          confidence: 0.9,
          mechanism: 'Rate stability supports net interest margins',
        },
        {
          id: 'e2',
          source: 'n2',
          target: 'n3',
          magnitude: 0.7,
          direction: 'positive',
          confidence: 0.85,
          mechanism: 'Higher margins flow to bank earnings',
        },
        {
          id: 'e3',
          source: 'n3',
          target: 'n4',
          magnitude: 0.6,
          direction: 'positive',
          confidence: 0.75,
          mechanism: 'ZEB holds equal weight in all Big 6 banks',
        },
      ],
      summary: 'BoC rate hold supports Canadian bank margins, benefiting ZEB holdings.',
      disclaimer: 'For informational purposes only.',
      maxHops: 3,
      isSpeculative: false,
    }

    it('validates a correct causal chain', () => {
      const result = validateCausalChain(JSON.stringify(validChain))
      expect(result.success).toBe(true)
      expect(result.chain).toBeDefined()
    })

    it('handles markdown-fenced JSON', () => {
      const result = validateCausalChain('```json\n' + JSON.stringify(validChain) + '\n```')
      expect(result.success).toBe(true)
    })

    it('returns errors for malformed JSON', () => {
      const result = validateCausalChain('not json at all')
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('returns specific Zod errors for schema violations', () => {
      const bad = { ...validChain, nodes: 'not an array' }
      const result = validateCausalChain(JSON.stringify(bad))
      expect(result.success).toBe(false)
      expect(result.errors!.length).toBeGreaterThan(0)
    })

    it('computes max hops correctly', () => {
      const result = validateCausalChain(JSON.stringify(validChain))
      expect(result.chain!.maxHops).toBe(3)
    })

    it('flags chains with >3 hops as speculative', () => {
      const longChain = {
        ...validChain,
        nodes: [
          ...validChain.nodes,
          {
            id: 'n5',
            type: 'asset',
            label: 'Deep',
            description: 'Deep impact',
            confidence: 0.3,
            metadata: {},
          },
        ],
        edges: [
          ...validChain.edges,
          {
            id: 'e4',
            source: 'n4',
            target: 'n5',
            magnitude: 0.3,
            direction: 'negative',
            confidence: 0.3,
            mechanism: 'Secondary effect',
          },
        ],
      }
      const result = validateCausalChain(JSON.stringify(longChain))
      expect(result.success).toBe(true)
      expect(result.chain!.isSpeculative).toBe(true)
    })
  })
})
