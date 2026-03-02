import { describe, it, expect } from 'vitest'
import { generateConsoleReport, generateMarkdownReport } from '../report'
import type { EvalReport } from '../types'

function makeMockReport(): EvalReport {
  return {
    timestamp: '2026-02-28T00:00:00.000Z',
    eventCount: 2,
    multiAgent: {
      directionalAccuracy: 0.72,
      rangeCoverage: 0.65,
      evidenceGrounding: 0.82,
      perEventType: new Map([
        ['rate_decision', { accuracy: 0.80, coverage: 0.70 }],
        ['oil_shock', { accuracy: 0.68, coverage: 0.55 }],
      ]),
      averageJudgeScore: {
        causalReasoning: 4.2,
        calibration: 3.8,
        riskIdentification: 4.0,
        recommendationQuality: 3.5,
        transparency: 4.5,
        overall: 4.0,
      },
    },
    singleAgent: {
      directionalAccuracy: 0.54,
      rangeCoverage: 0.35,
      perEventType: new Map([
        ['rate_decision', { accuracy: 0.60, coverage: 0.30 }],
        ['oil_shock', { accuracy: 0.50, coverage: 0.25 }],
      ]),
      averageJudgeScore: {
        causalReasoning: 2.1,
        calibration: 2.3,
        riskIdentification: 1.8,
        recommendationQuality: 0,
        transparency: 1.5,
        overall: 1.54,
      },
    },
    pro25SingleAgent: {
      directionalAccuracy: 0.62,
      rangeCoverage: 0.42,
      perEventType: new Map([
        ['rate_decision', { accuracy: 0.70, coverage: 0.40 }],
        ['oil_shock', { accuracy: 0.55, coverage: 0.35 }],
      ]),
      averageJudgeScore: {
        causalReasoning: 3.4,
        calibration: 3.0,
        riskIdentification: 2.8,
        recommendationQuality: 0,
        transparency: 2.5,
        overall: 2.34,
      },
    },
    results: [
      {
        eventId: 'fed-75bps-2022-06',
        eventType: 'rate_decision',
        multiAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -500, high: -100 },
          holdingDirections: new Map(),
          qualityScore: 0.75,
          reasoning: 'Multi-agent full research brief text',
        },
        singleAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -800, high: 200 },
          holdingDirections: new Map(),
          reasoning: 'Single-agent reasoning',
        },
        pro25SingleAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -600, high: 100 },
          holdingDirections: new Map(),
          reasoning: 'Flash 3 reasoning',
        },
        actual: {
          returns5d: { VFV: -0.058 },
          netDirection: 'negative',
        },
      },
    ],
  }
}

describe('generateConsoleReport', () => {
  it('includes all major sections', () => {
    const report = generateConsoleReport(makeMockReport())
    expect(report).toContain('PRISM 3-WAY EVALUATION REPORT')
    expect(report).toContain('DIRECTIONAL ACCURACY')
    expect(report).toContain('CONFIDENCE RANGE COVERAGE')
    expect(report).toContain('EVIDENCE GROUNDING')
    expect(report).toContain('BY EVENT TYPE')
  })

  it('includes all three systems', () => {
    const report = generateConsoleReport(makeMockReport())
    expect(report).toContain('Single 2.5')
    expect(report).toContain('Single 2.5P')
    expect(report).toContain('Multi-agent')
  })

  it('includes quality scores section', () => {
    const report = generateConsoleReport(makeMockReport())
    expect(report).toContain('QUALITY SCORES')
    expect(report).toContain('Causal Reasoning')
    expect(report).toContain('Calibration')
    expect(report).toContain('Transparency')
  })

  it('includes percentages', () => {
    const report = generateConsoleReport(makeMockReport())
    expect(report).toContain('72%')
    expect(report).toContain('54%')
    expect(report).toContain('62%')
  })
})

describe('generateMarkdownReport', () => {
  it('includes 3-way summary table', () => {
    const report = generateMarkdownReport(makeMockReport())
    expect(report).toContain('Single 2.5 Flash')
    expect(report).toContain('Single 2.5 Pro')
    expect(report).toContain('Multi-Agent')
    expect(report).toContain('Delta (MA vs 2.5 Pro)')
  })

  it('includes quality score table', () => {
    const report = generateMarkdownReport(makeMockReport())
    expect(report).toContain('Quality Scores')
    expect(report).toContain('Causal Reasoning')
    expect(report).toContain('Recommendation Quality')
  })

  it('includes per-event results with 3 systems', () => {
    const report = generateMarkdownReport(makeMockReport())
    expect(report).toContain('fed-75bps-2022-06')
    expect(report).toContain('rate_decision')
    // Per-event table should have 6 columns (Event, Type, 3 systems, Actual)
    const perEventHeader = report.split('\n').find((l) => l.includes('Single 2.5') && l.includes('Single 2.5P') && l.includes('Multi-Agent') && l.includes('Actual'))
    expect(perEventHeader).toBeDefined()
  })

  it('includes narrative', () => {
    const report = generateMarkdownReport(makeMockReport())
    expect(report).toContain('Narrative')
  })

  it('is valid markdown (no broken tables)', () => {
    const report = generateMarkdownReport(makeMockReport())
    const tableLines = report.split('\n').filter((l) => l.startsWith('|'))
    for (const line of tableLines) {
      const pipeCount = (line.match(/\|/g) ?? []).length
      expect(pipeCount).toBeGreaterThanOrEqual(4) // at least 3 columns
    }
  })
})
