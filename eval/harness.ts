// Evaluation harness — runs multi-agent pipeline and single-agent baseline
// against 25 historical events with ground truth from Yahoo Finance.

import { getUserProfileById } from '@prism/data'
import type { Signal } from '@prism/shared'
import { runMultiAgentAnalysis } from '../agents/src/multi-agent'
import { runSingleAgentBaseline } from './baselines/single-agent'
import { QA_DATASET_25 } from './qa-dataset'
import { buildCanonicalEvalPortfolio } from './eval-portfolio'
import { buildSimpleExposureMap } from './exposure-map'
import {
  classifyActualDirection,
  computeSystemMetrics,
} from './metrics'
import { generateConsoleReport, generateMarkdownReport } from './report'
import type { EvalReport, EvalResult, QaExample } from './types'

// ── Sentiment Inference ──────────────────────────────────

function inferSentiment(example: QaExample): 'positive' | 'negative' | 'mixed' {
  const desc = example.eventDescription.toLowerCase()

  switch (example.type) {
    case 'rate_decision': {
      if (/\b(hike|raises?|tighten|hawkish)\b/.test(desc)) return 'negative'
      if (/\b(cut|pause|easing|dovish)\b/.test(desc)) return 'positive'
      return 'negative' // Default for rate decisions
    }
    case 'cpi_surprise': {
      if (/\b(hot|sticky|surge|accelerat)/i.test(desc)) return 'negative'
      if (/\b(cool|drop|deceler|slow|eas)/i.test(desc)) return 'positive'
      return 'negative'
    }
    case 'oil_shock':
      return 'mixed' // Energy gains, equities lose (or vice versa)
    case 'banking_stress':
      return 'negative'
    case 'geopolitical':
      return 'mixed'
    case 'currency_fx':
      return 'mixed'
    default:
      return 'negative'
  }
}

// ── Event → Signal Converter ───────────────────────────────

function eventToSignal(example: QaExample): Signal {
  return {
    id: example.id,
    headline: example.query,
    description: `${example.eventDescription}\n\nQuestion: ${example.query}`,
    affectedExposures: Object.keys(example.actualReturns5d),
    relevanceScore: 0.8,
    urgency: 'high',
    sentiment: inferSentiment(example),
    temporalClassification: 'near_term',
    sources: [{
      title: example.eventDescription.split('.')[0] ?? example.eventDescription,
      url: example.sourceUrl,
    }],
    detectedAt: new Date(example.date).toISOString(),
    acknowledged: false,
  }
}

// ── Main Harness ───────────────────────────────────────────

export interface HarnessOptions {
  /** Only run first N events (for quick testing) */
  readonly limit?: number
  /** Skip multi-agent pipeline (for testing metrics/report only) */
  readonly skipMultiAgent?: boolean
  /** Skip single-agent baseline */
  readonly skipSingleAgent?: boolean
  /** Run events in parallel (faster but uses more API quota) */
  readonly parallel?: boolean
}

export async function runEvaluation(options: HarnessOptions = {}): Promise<EvalReport> {
  const {
    limit,
    skipMultiAgent = false,
    skipSingleAgent = false,
    parallel = false,
  } = options

  const examples = limit ? QA_DATASET_25.slice(0, limit) : QA_DATASET_25
  const portfolio = buildCanonicalEvalPortfolio()
  const userProfile = getUserProfileById('sarah-01')

  if (!userProfile) {
    throw new Error('Demo profile sarah-01 not found')
  }

  const exposureMap = buildSimpleExposureMap(portfolio)

  let eventIndex = 0
  const totalEvents = examples.length

  const evaluateEvent = async (example: QaExample): Promise<EvalResult> => {
    eventIndex++
    const startTime = Date.now()
    console.log(`[${eventIndex}/${totalEvents}] ${example.id} — starting...`)

    const signal = eventToSignal(example)
    const actualDirection = classifyActualDirection(example.actualReturns5d)

    // Run multi-agent pipeline
    let multiAgentResult: EvalResult['multiAgent']
    if (skipMultiAgent) {
      multiAgentResult = {
        direction: 'mixed',
        dollarImpactRange: { low: -1000, high: 1000 },
        holdingDirections: new Map(),
        qualityScore: 0,
      }
    } else {
      try {
        const result = await runMultiAgentAnalysis({
          signal,
          portfolio,
          exposureMap,
          userProfile,
          skipCheckpoints: true,
        })

        const totalLow = result.verdict.holdingImpacts
          .map((h) => h.impact['1W']?.low ?? 0)
          .reduce((sum, v) => sum + v, 0)
        const totalHigh = result.verdict.holdingImpacts
          .map((h) => h.impact['1W']?.high ?? 0)
          .reduce((sum, v) => sum + v, 0)

        const holdingDirections = new Map(
          result.verdict.holdingImpacts.map((h) => [h.ticker, h.direction]),
        )

        multiAgentResult = {
          direction: totalLow + totalHigh > 0 ? 'positive' : totalLow + totalHigh < 0 ? 'negative' : 'mixed',
          dollarImpactRange: { low: totalLow, high: totalHigh },
          holdingDirections,
          qualityScore: result.verdict.qualityScore,
        }
      } catch (error) {
        console.error(`Multi-agent failed for ${example.id}:`, error)
        multiAgentResult = {
          direction: 'mixed',
          dollarImpactRange: { low: -1000, high: 1000 },
          holdingDirections: new Map(),
          qualityScore: 0,
        }
      }
    }

    // Run single-agent baseline
    let singleAgentResult: EvalResult['singleAgent']
    if (skipSingleAgent) {
      singleAgentResult = {
        direction: 'mixed',
        dollarImpactRange: { low: -1000, high: 1000 },
        holdingDirections: new Map(),
      }
    } else {
      try {
        const baseline = await runSingleAgentBaseline({
          signal,
          portfolio,
          exposureMap,
        })

        singleAgentResult = {
          direction: baseline.direction,
          dollarImpactRange: { low: baseline.confidenceLow, high: baseline.confidenceHigh },
          holdingDirections: new Map(baseline.perHolding.map((h) => [h.ticker, h.direction])),
        }
      } catch (error) {
        console.error(`Single-agent failed for ${example.id}:`, error)
        singleAgentResult = {
          direction: 'mixed',
          dollarImpactRange: { low: -1000, high: 1000 },
          holdingDirections: new Map(),
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[${eventIndex}/${totalEvents}] ${example.id} — done (${elapsed}s) MA=${multiAgentResult.direction} SA=${singleAgentResult.direction} actual=${actualDirection}`)

    return {
      eventId: example.id,
      eventType: example.type,
      multiAgent: multiAgentResult,
      singleAgent: singleAgentResult,
      actual: {
        returns5d: example.actualReturns5d,
        netDirection: actualDirection,
      },
    }
  }

  // Run evaluation
  const results = parallel
    ? await Promise.all(examples.map(evaluateEvent))
    : await runSequential(examples, evaluateEvent)

  const report: EvalReport = {
    timestamp: new Date().toISOString(),
    eventCount: examples.length,
    multiAgent: computeSystemMetrics(results, 'multiAgent'),
    singleAgent: computeSystemMetrics(results, 'singleAgent'),
    results,
  }

  return report
}

async function runSequential<T, R>(items: readonly T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = []
  for (const item of items) {
    results.push(await fn(item))
  }
  return results
}

// ── CLI Entry Point ────────────────────────────────────────

export async function main(): Promise<void> {
  console.log('Starting Prism evaluation harness...')
  console.log(`Q&A examples: ${QA_DATASET_25.length}`)
  console.log('')

  const report = await runEvaluation({ parallel: false })

  console.log(generateConsoleReport(report))

  const fs = await import('node:fs/promises')

  // Write JSON results
  const jsonPath = `eval/results-qa-${report.timestamp.replace(/:/g, '-')}.json`
  const serializable = {
    ...report,
    multiAgent: {
      ...report.multiAgent,
      perEventType: Object.fromEntries(report.multiAgent.perEventType),
    },
    singleAgent: {
      ...report.singleAgent,
      perEventType: Object.fromEntries(report.singleAgent.perEventType),
    },
    results: report.results.map((r) => ({
      ...r,
      multiAgent: { ...r.multiAgent, holdingDirections: Object.fromEntries(r.multiAgent.holdingDirections) },
      singleAgent: { ...r.singleAgent, holdingDirections: Object.fromEntries(r.singleAgent.holdingDirections) },
    })),
  }
  await fs.writeFile(jsonPath, JSON.stringify(serializable, null, 2), 'utf-8')
  console.log(`\nJSON results written to ${jsonPath}`)

  // Write markdown report
  const markdownReport = generateMarkdownReport(report)
  await fs.writeFile('eval/REPORT.md', markdownReport, 'utf-8')
  console.log('Markdown report written to eval/REPORT.md')
}
