// Evaluation harness — runs multi-agent pipeline, two single-agent baselines,
// and optional LLM-as-judge scoring against 25 historical events with ground truth.

import { getUserProfileById } from '@prism/data'
import type { Signal } from '@prism/shared'
import { runMultiAgentAnalysis } from '../agents/src/multi-agent'
import { runSingleAgentBaseline } from './baselines/single-agent'
import { judgeSystemOutput } from './judge'
import { QA_DATASET_25 } from './qa-dataset'
import { buildCanonicalEvalPortfolio } from './eval-portfolio'
import { buildSimpleExposureMap } from './exposure-map'
import {
  classifyActualDirection,
  computeSystemMetrics,
} from './metrics'
import { generateConsoleReport, generateMarkdownReport } from './report'
import type { BaselineResult, EvalReport, EvalResult, JudgeScore, QaExample } from './types'

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

// ── Fallback Results ─────────────────────────────────────────

function fallbackBaselineResult(): BaselineResult {
  return {
    direction: 'mixed',
    dollarImpactRange: { low: -1000, high: 1000 },
    holdingDirections: new Map(),
    reasoning: 'System failed or was skipped',
  }
}

function fallbackMultiAgentResult(): EvalResult['multiAgent'] {
  return {
    direction: 'mixed',
    dollarImpactRange: { low: -1000, high: 1000 },
    holdingDirections: new Map(),
    qualityScore: 0,
    reasoning: 'System failed or was skipped',
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
  /** Skip Gemini 2.5 Pro single-agent baseline */
  readonly skipPro25SingleAgent?: boolean
  /** Skip LLM-as-judge scoring (for fast regression testing) */
  readonly skipJudge?: boolean
  /** Run events in parallel (faster but uses more API quota) */
  readonly parallel?: boolean
  /** Max concurrent events (bounded parallelism). 1 = sequential. */
  readonly concurrency?: number
}

export async function runEvaluation(options: HarnessOptions = {}): Promise<EvalReport> {
  const {
    limit,
    skipMultiAgent = false,
    skipSingleAgent = false,
    skipPro25SingleAgent = false,
    skipJudge = false,
    parallel = false,
    concurrency,
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
    const currentIndex = eventIndex
    const startTime = Date.now()
    console.log(`[${currentIndex}/${totalEvents}] ${example.id} — starting...`)

    const signal = eventToSignal(example)
    const actualDirection = classifyActualDirection(example.actualReturns5d)

    // ── Run multi-agent pipeline ──────────────────────────
    let multiAgentResult: EvalResult['multiAgent']
    if (skipMultiAgent) {
      multiAgentResult = fallbackMultiAgentResult()
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
          reasoning: result.researchBrief.fullText,
        }
      } catch (error) {
        console.error(`Multi-agent failed for ${example.id}:`, error)
        multiAgentResult = fallbackMultiAgentResult()
      }
    }

    // ── Run single-agent baseline (Gemini 2.5 Flash) ──────
    let singleAgentResult: BaselineResult
    if (skipSingleAgent) {
      singleAgentResult = fallbackBaselineResult()
    } else {
      try {
        const baseline = await runSingleAgentBaseline({
          signal,
          portfolio,
          exposureMap,
          model: 'gemini-2.5-flash',
        })

        singleAgentResult = {
          direction: baseline.direction,
          dollarImpactRange: { low: baseline.confidenceLow, high: baseline.confidenceHigh },
          holdingDirections: new Map(baseline.perHolding.map((h) => [h.ticker, h.direction])),
          reasoning: baseline.reasoning,
        }
      } catch (error) {
        console.error(`Single-agent (2.5 Flash) failed for ${example.id}:`, error)
        singleAgentResult = fallbackBaselineResult()
      }
    }

    // ── Run Gemini 2.5 Pro single-agent baseline ──────────
    let pro25Result: BaselineResult
    if (skipPro25SingleAgent) {
      pro25Result = fallbackBaselineResult()
    } else {
      try {
        const baseline = await runSingleAgentBaseline({
          signal,
          portfolio,
          exposureMap,
          model: 'gemini-2.5-pro',
        })

        pro25Result = {
          direction: baseline.direction,
          dollarImpactRange: { low: baseline.confidenceLow, high: baseline.confidenceHigh },
          holdingDirections: new Map(baseline.perHolding.map((h) => [h.ticker, h.direction])),
          reasoning: baseline.reasoning,
        }
      } catch (error) {
        console.error(`Single-agent (2.5 Pro) failed for ${example.id}:`, error)
        pro25Result = fallbackBaselineResult()
      }
    }

    // ── Judge scoring ─────────────────────────────────────
    if (!skipJudge) {
      const judgeInput = {
        signal: { headline: signal.headline, description: signal.description },
        actualDirection,
      }

      const [maScore, saScore, f3Score] = await Promise.all([
        skipMultiAgent
          ? Promise.resolve(undefined)
          : judgeSystemOutput({
              ...judgeInput,
              system: 'System A',
              direction: multiAgentResult.direction,
              dollarRange: multiAgentResult.dollarImpactRange,
              reasoning: multiAgentResult.reasoning,
            }),
        skipSingleAgent
          ? Promise.resolve(undefined)
          : judgeSystemOutput({
              ...judgeInput,
              system: 'System B',
              direction: singleAgentResult.direction,
              dollarRange: singleAgentResult.dollarImpactRange,
              reasoning: singleAgentResult.reasoning,
            }),
        skipPro25SingleAgent
          ? Promise.resolve(undefined)
          : judgeSystemOutput({
              ...judgeInput,
              system: 'System C',
              direction: pro25Result.direction,
              dollarRange: pro25Result.dollarImpactRange,
              reasoning: pro25Result.reasoning,
            }),
      ])

      if (maScore) {
        multiAgentResult = { ...multiAgentResult, judgeScore: maScore }
      }
      if (saScore) {
        singleAgentResult = { ...singleAgentResult, judgeScore: saScore }
      }
      if (f3Score) {
        pro25Result = { ...pro25Result, judgeScore: f3Score }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(
      `[${currentIndex}/${totalEvents}] ${example.id} — done (${elapsed}s) ` +
      `MA=${multiAgentResult.direction} SA=${singleAgentResult.direction} ` +
      `Pro=${pro25Result.direction} actual=${actualDirection}`,
    )

    return {
      eventId: example.id,
      eventType: example.type,
      multiAgent: multiAgentResult,
      singleAgent: singleAgentResult,
      pro25SingleAgent: pro25Result,
      actual: {
        returns5d: example.actualReturns5d,
        netDirection: actualDirection,
      },
    }
  }

  // Run evaluation
  const effectiveConcurrency = concurrency ?? (parallel ? examples.length : 1)
  const results = effectiveConcurrency <= 1
    ? await runSequential(examples, evaluateEvent)
    : await runWithConcurrency(examples, evaluateEvent, effectiveConcurrency)

  const report: EvalReport = {
    timestamp: new Date().toISOString(),
    eventCount: examples.length,
    multiAgent: computeSystemMetrics(results, 'multiAgent'),
    singleAgent: computeSystemMetrics(results, 'singleAgent'),
    pro25SingleAgent: computeSystemMetrics(results, 'pro25SingleAgent'),
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

async function runWithConcurrency<T, R>(
  items: readonly T[],
  fn: (item: T) => Promise<R>,
  maxConcurrent: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await fn(items[index])
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrent, items.length) },
    () => worker(),
  )
  await Promise.all(workers)
  return results
}

// ── Rejudge Mode ─────────────────────────────────────────────
// Loads a previous results JSON and re-scores only events with zero judge scores.

function hasZeroJudgeScore(score?: JudgeScore): boolean {
  return !score || score.overall === 0
}

interface SerializedResult {
  readonly eventId: string
  readonly eventType: string
  readonly multiAgent: {
    readonly direction: 'positive' | 'negative' | 'mixed'
    readonly dollarImpactRange: { readonly low: number; readonly high: number }
    readonly holdingDirections: Readonly<Record<string, number>>
    readonly qualityScore: number
    readonly reasoning: string
    readonly judgeScore?: JudgeScore
  }
  readonly singleAgent: {
    readonly direction: 'positive' | 'negative' | 'mixed'
    readonly dollarImpactRange: { readonly low: number; readonly high: number }
    readonly holdingDirections: Readonly<Record<string, number>>
    readonly reasoning: string
    readonly judgeScore?: JudgeScore
  }
  readonly pro25SingleAgent: {
    readonly direction: 'positive' | 'negative' | 'mixed'
    readonly dollarImpactRange: { readonly low: number; readonly high: number }
    readonly holdingDirections: Readonly<Record<string, number>>
    readonly reasoning: string
    readonly judgeScore?: JudgeScore
  }
  readonly actual: {
    readonly returns5d: Readonly<Record<string, number>>
    readonly netDirection: 'positive' | 'negative' | 'neutral'
  }
}

export async function rejudge(
  inputPath: string,
  options: { readonly concurrency?: number } = {},
): Promise<EvalReport> {
  const fs = await import('node:fs/promises')
  const raw = JSON.parse(await fs.readFile(inputPath, 'utf-8'))
  const results: SerializedResult[] = raw.results

  const systemLabels: Record<string, string> = {
    multiAgent: 'System A',
    singleAgent: 'System B',
    pro25SingleAgent: 'System C',
  }

  const systemKeys = ['multiAgent', 'singleAgent', 'pro25SingleAgent'] as const

  // Build list of (resultIndex, systemKey) pairs that need re-judging
  const tasks: { readonly resultIndex: number; readonly systemKey: 'multiAgent' | 'singleAgent' | 'pro25SingleAgent' }[] = []
  for (let i = 0; i < results.length; i++) {
    for (const key of systemKeys) {
      if (hasZeroJudgeScore(results[i][key].judgeScore)) {
        tasks.push({ resultIndex: i, systemKey: key })
      }
    }
  }

  console.log(`Found ${tasks.length} zero-scored judge entries to re-score across ${results.length} events.\n`)

  // Mutable scores map: results[i][key] → new JudgeScore
  const newScores = new Map<string, JudgeScore>()
  let completedCount = 0

  const processTask = async (task: typeof tasks[number]): Promise<void> => {
    const result = results[task.resultIndex]
    const signal = QA_DATASET_25.find((e) => e.id === result.eventId)
    const signalInfo = signal
      ? { headline: signal.query, description: `${signal.eventDescription}\n\nQuestion: ${signal.query}` }
      : { headline: result.eventId, description: '' }

    const systemResult = result[task.systemKey]
    const current = ++completedCount
    console.log(`[${current}/${tasks.length}] Re-judging ${result.eventId} / ${task.systemKey}...`)

    const newScore = await judgeSystemOutput({
      signal: signalInfo,
      actualDirection: result.actual.netDirection,
      system: systemLabels[task.systemKey],
      direction: systemResult.direction,
      dollarRange: systemResult.dollarImpactRange,
      reasoning: systemResult.reasoning,
    })

    newScores.set(`${task.resultIndex}:${task.systemKey}`, newScore)
    console.log(`  → overall: ${newScore.overall}`)
  }

  const concurrency = options.concurrency ?? 1
  if (concurrency <= 1) {
    await runSequential(tasks, processTask)
  } else {
    await runWithConcurrency(tasks, processTask, concurrency)
  }

  // Merge new scores into results and reconstruct EvalResults
  const updatedResults: EvalResult[] = results.map((result, i) => {
    const getScore = (key: typeof systemKeys[number]) =>
      newScores.get(`${i}:${key}`) ?? result[key].judgeScore

    return {
      eventId: result.eventId,
      eventType: result.eventType as EvalResult['eventType'],
      multiAgent: {
        ...result.multiAgent,
        judgeScore: getScore('multiAgent'),
        holdingDirections: new Map(Object.entries(result.multiAgent.holdingDirections)),
      },
      singleAgent: {
        ...result.singleAgent,
        judgeScore: getScore('singleAgent'),
        holdingDirections: new Map(Object.entries(result.singleAgent.holdingDirections)),
      },
      pro25SingleAgent: {
        ...result.pro25SingleAgent,
        judgeScore: getScore('pro25SingleAgent'),
        holdingDirections: new Map(Object.entries(result.pro25SingleAgent.holdingDirections)),
      },
      actual: result.actual,
    }
  })

  console.log(`\nRe-judged ${tasks.length} entries.`)

  return {
    timestamp: new Date().toISOString(),
    eventCount: updatedResults.length,
    multiAgent: computeSystemMetrics(updatedResults, 'multiAgent'),
    singleAgent: computeSystemMetrics(updatedResults, 'singleAgent'),
    pro25SingleAgent: computeSystemMetrics(updatedResults, 'pro25SingleAgent'),
    results: updatedResults,
  }
}

// ── CLI Entry Point ────────────────────────────────────────

export async function main(): Promise<void> {
  console.log('Starting Prism evaluation harness...')
  console.log(`Q&A examples: ${QA_DATASET_25.length}`)
  console.log('')

  const report = await runEvaluation({ parallel: false })

  console.log(generateConsoleReport(report))

  const fs = await import('node:fs/promises')

  // Serialize Maps for JSON output
  const serializeMap = (m: ReadonlyMap<string, unknown>) => Object.fromEntries(m)

  const jsonPath = `eval/results-qa-${report.timestamp.replace(/:/g, '-')}.json`
  const serializable = {
    ...report,
    multiAgent: {
      ...report.multiAgent,
      perEventType: serializeMap(report.multiAgent.perEventType),
    },
    singleAgent: {
      ...report.singleAgent,
      perEventType: serializeMap(report.singleAgent.perEventType),
    },
    pro25SingleAgent: {
      ...report.pro25SingleAgent,
      perEventType: serializeMap(report.pro25SingleAgent.perEventType),
    },
    results: report.results.map((r) => ({
      ...r,
      multiAgent: { ...r.multiAgent, holdingDirections: serializeMap(r.multiAgent.holdingDirections) },
      singleAgent: { ...r.singleAgent, holdingDirections: serializeMap(r.singleAgent.holdingDirections) },
      pro25SingleAgent: { ...r.pro25SingleAgent, holdingDirections: serializeMap(r.pro25SingleAgent.holdingDirections) },
    })),
  }
  await fs.writeFile(jsonPath, JSON.stringify(serializable, null, 2), 'utf-8')
  console.log(`\nJSON results written to ${jsonPath}`)

  // Write markdown report
  const markdownReport = generateMarkdownReport(report)
  await fs.writeFile('eval/REPORT.md', markdownReport, 'utf-8')
  console.log('Markdown report written to eval/REPORT.md')
}
