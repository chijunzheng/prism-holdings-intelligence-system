import { describe, it, expect } from 'vitest'
import { buildSignalSearchPrompt } from '../prompts'
import { parseSignalResponse, deduplicateSignals } from '../parse'
import type { ExposureEntry } from '@prism/shared'

const sampleExposures: ReadonlyArray<ExposureEntry> = [
  {
    category: 'Canadian Financials',
    percentage: 17.1,
    valueCad: 6840,
    contributingHoldings: [
      { ticker: 'XIC', contribution: 6.5 },
      { ticker: 'ZEB', contribution: 10.5 },
    ],
  },
  {
    category: 'US Technology',
    percentage: 12.0,
    valueCad: 4800,
    contributingHoldings: [{ ticker: 'VFV', contribution: 12.0 }],
  },
]

describe('Signal Monitor', () => {
  describe('Prompt construction', () => {
    it('includes top exposure categories in the prompt', () => {
      const prompt = buildSignalSearchPrompt(sampleExposures)
      expect(prompt).toContain('Canadian Financials')
      expect(prompt).toContain('US Technology')
      expect(prompt).toContain('17.1%')
    })

    it('requests structured JSON output', () => {
      const prompt = buildSignalSearchPrompt(sampleExposures)
      expect(prompt).toContain('JSON array')
      expect(prompt).toContain('headline')
      expect(prompt).toContain('sources')
    })
  })

  describe('Response parsing', () => {
    it('parses a valid Gemini response into Signal objects', () => {
      const response = JSON.stringify([
        {
          headline: 'BoC Holds Rate at 2.25%',
          description: 'The Bank of Canada held its key rate steady at 2.25%.',
          affectedExposures: ['Canadian Financials'],
          relevanceScore: 0.9,
          urgency: 'high',
          temporalClassification: 'structural',
          sources: [
            {
              title: 'BoC Rate Decision',
              url: 'https://www.bankofcanada.ca/2026/02/rate-decision/',
              publisher: 'Bank of Canada',
            },
          ],
        },
      ])

      const signals = parseSignalResponse(response)
      expect(signals).toHaveLength(1)
      expect(signals[0].headline).toBe('BoC Holds Rate at 2.25%')
      expect(signals[0].urgency).toBe('high')
      expect(signals[0].sources).toHaveLength(1)
    })

    it('handles markdown-fenced JSON', () => {
      const response = '```json\n[{"headline":"Test","description":"Test event","affectedExposures":["Canadian Financials"],"relevanceScore":0.7,"urgency":"medium","temporalClassification":"transient","sources":[{"title":"Test","url":"https://example.com"}]}]\n```'
      const signals = parseSignalResponse(response)
      expect(signals).toHaveLength(1)
    })

    it('returns empty array for malformed response', () => {
      const signals = parseSignalResponse('This is not JSON at all')
      expect(signals).toHaveLength(0)
    })

    it('skips individual malformed signals but parses valid ones', () => {
      const response = JSON.stringify([
        {
          headline: 'Valid Signal',
          description: 'A real event',
          affectedExposures: ['Canadian Financials'],
          relevanceScore: 0.8,
          urgency: 'high',
          temporalClassification: 'structural',
          sources: [{ title: 'Source', url: 'https://example.com' }],
        },
        {
          headline: 'Invalid — missing fields',
        },
      ])

      const signals = parseSignalResponse(response)
      expect(signals).toHaveLength(1)
      expect(signals[0].headline).toBe('Valid Signal')
    })

    it('clamps relevance scores to 0-1 range', () => {
      const response = JSON.stringify([
        {
          headline: 'High Score',
          description: 'Test',
          affectedExposures: ['US Technology'],
          relevanceScore: 1.5,
          urgency: 'medium',
          temporalClassification: 'transient',
          sources: [{ title: 'S', url: 'https://example.com' }],
        },
      ])

      const signals = parseSignalResponse(response)
      expect(signals[0].relevanceScore).toBeLessThanOrEqual(1)
    })
  })

  describe('Deduplication', () => {
    it('removes duplicate signals keeping highest relevance', () => {
      const signals = parseSignalResponse(
        JSON.stringify([
          {
            headline: 'BoC Rate Decision February 2026',
            description: 'The Bank of Canada held rates.',
            affectedExposures: ['Canadian Financials'],
            relevanceScore: 0.9,
            urgency: 'high',
            temporalClassification: 'structural',
            sources: [{ title: 'BoC', url: 'https://boc.ca' }],
          },
          {
            headline: 'BoC Rate Decision February 2026 Update',
            description: 'Updated: rates held steady.',
            affectedExposures: ['Canadian Financials'],
            relevanceScore: 0.7,
            urgency: 'medium',
            temporalClassification: 'structural',
            sources: [{ title: 'Reuters', url: 'https://reuters.com' }],
          },
        ]),
      )

      const deduped = deduplicateSignals(signals)
      expect(deduped).toHaveLength(1)
      expect(deduped[0].relevanceScore).toBe(0.9)
    })
  })
})
