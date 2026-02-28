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
    },
    singleAgent: {
      directionalAccuracy: 0.54,
      rangeCoverage: 0.35,
      perEventType: new Map([
        ['rate_decision', { accuracy: 0.60, coverage: 0.30 }],
        ['oil_shock', { accuracy: 0.50, coverage: 0.25 }],
      ]),
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
        },
        singleAgent: {
          direction: 'negative',
          dollarImpactRange: { low: -800, high: 200 },
          holdingDirections: new Map(),
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
    expect(report).toContain('PRISM EVALUATION REPORT')
    expect(report).toContain('DIRECTIONAL ACCURACY')
    expect(report).toContain('CONFIDENCE RANGE COVERAGE')
    expect(report).toContain('EVIDENCE GROUNDING')
    expect(report).toContain('BY EVENT TYPE')
  })

  it('includes percentages', () => {
    const report = generateConsoleReport(makeMockReport())
    expect(report).toContain('72%')
    expect(report).toContain('54%')
  })
})

describe('generateMarkdownReport', () => {
  it('includes markdown table headers', () => {
    const report = generateMarkdownReport(makeMockReport())
    expect(report).toContain('| Metric | Single-Agent | Multi-Agent | Delta |')
    expect(report).toContain('# Prism Evaluation Report')
  })

  it('includes per-event results', () => {
    const report = generateMarkdownReport(makeMockReport())
    expect(report).toContain('fed-75bps-2022-06')
    expect(report).toContain('rate_decision')
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
