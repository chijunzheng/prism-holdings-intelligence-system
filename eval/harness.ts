// Evaluation harness — runs multi-agent pipeline and single-agent baseline
// against 25 historical events with ground truth from Yahoo Finance.

import { getPortfolioByUserId, getUserProfileById } from '@prism/data'
import type { Signal, ExposureMap } from '@prism/shared'
import { runMultiAgentAnalysis } from '../agents/src/multi-agent'
import { runSingleAgentBaseline } from './baselines/single-agent'
import { HISTORICAL_EVENTS } from './events'
import {
  classifyActualDirection,
  computeSystemMetrics,
} from './metrics'
import { generateConsoleReport, generateMarkdownReport } from './report'
import type { EvalReport, EvalResult, HistoricalEvent } from './types'

// ── Event → Signal Converter ───────────────────────────────

function eventToSignal(event: HistoricalEvent): Signal {
  return {
    id: event.id,
    headline: event.description.split('.')[0] ?? event.description,
    description: event.description,
    affectedExposures: Object.keys(event.actualReturns5d),
    relevanceScore: 0.8,
    urgency: 'high',
    sentiment: 'negative',
    temporalClassification: 'near_term',
    sources: [{
      title: event.description.split('.')[0] ?? event.description,
      url: event.sourceUrl,
    }],
    detectedAt: new Date(event.date).toISOString(),
    acknowledged: false,
  }
}

// ── Build Exposure Map ─────────────────────────────────────

function buildSimpleExposureMap(tickers: readonly string[]): ExposureMap {
  const exposureMap: Record<string, Array<{ ticker: string; weight: number }>> = {}

  for (const ticker of tickers) {
    const category = categorizeHolding(ticker)
    if (!exposureMap[category]) {
      exposureMap[category] = []
    }
    exposureMap[category].push({ ticker, weight: 1 / tickers.length })
  }

  return exposureMap as ExposureMap
}

function categorizeHolding(ticker: string): string {
  const categories: Record<string, string> = {
    VFV: 'US Equity',
    XIC: 'Canadian Equity',
    ZAG: 'Fixed Income',
    ZEB: 'Canadian Banks',
    XEG: 'Energy',
    XGD: 'Gold/Precious Metals',
    ZDV: 'Canadian Dividend',
    XQQ: 'US Tech',
  }
  return categories[ticker] ?? 'Other'
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

  const events = limit ? HISTORICAL_EVENTS.slice(0, limit) : HISTORICAL_EVENTS
  const portfolio = getPortfolioByUserId('sarah-01')
  const userProfile = getUserProfileById('sarah-01')

  if (!portfolio || !userProfile) {
    throw new Error('Demo portfolio/profile sarah-01 not found')
  }

  const tickers = portfolio.accounts.flatMap((a) => a.holdings.map((h) => h.ticker))
  const exposureMap = buildSimpleExposureMap(tickers)

  const evaluateEvent = async (event: HistoricalEvent): Promise<EvalResult> => {
    const signal = eventToSignal(event)
    const actualDirection = classifyActualDirection(event.actualReturns5d)

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
          .map((h) => h.impact['1M']?.low ?? 0)
          .reduce((sum, v) => sum + v, 0)
        const totalHigh = result.verdict.holdingImpacts
          .map((h) => h.impact['1M']?.high ?? 0)
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
        console.error(`Multi-agent failed for ${event.id}:`, error)
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
        console.error(`Single-agent failed for ${event.id}:`, error)
        singleAgentResult = {
          direction: 'mixed',
          dollarImpactRange: { low: -1000, high: 1000 },
          holdingDirections: new Map(),
        }
      }
    }

    return {
      eventId: event.id,
      eventType: event.type,
      multiAgent: multiAgentResult,
      singleAgent: singleAgentResult,
      actual: {
        returns5d: event.actualReturns5d,
        netDirection: actualDirection,
      },
    }
  }

  // Run evaluation
  const results = parallel
    ? await Promise.all(events.map(evaluateEvent))
    : await runSequential(events, evaluateEvent)

  const report: EvalReport = {
    timestamp: new Date().toISOString(),
    eventCount: events.length,
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
  console.log(`Events: ${HISTORICAL_EVENTS.length}`)
  console.log('')

  const report = await runEvaluation({ parallel: false })

  console.log(generateConsoleReport(report))

  // Write markdown report
  const markdownReport = generateMarkdownReport(report)
  const fs = await import('node:fs/promises')
  await fs.writeFile('eval/REPORT.md', markdownReport, 'utf-8')
  console.log('\nMarkdown report written to eval/REPORT.md')
}
