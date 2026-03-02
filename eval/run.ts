// CLI runner for the 4-way evaluation harness.
// Usage:
//   npx tsx eval/run.ts                              — full 4-way eval (sequential)
//   npx tsx eval/run.ts --concurrency 3              — 3 events at a time
//   npx tsx eval/run.ts --skip-tradingagents         — skip TradingAgents (3-way only)
//   npx tsx eval/run.ts --limit 5                    — first 5 events only (pilot)
//   npx tsx eval/run.ts --rejudge <results.json>     — re-score zero-scored judge entries
//   npx tsx eval/run.ts --rejudge <file> --concurrency 5

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env before any agent imports
function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env')
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      process.env[key] = value
    }
  } catch {
    console.error('Warning: could not load .env file')
  }

  if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY
  }
}

function parseIntArg(flag: string): number | undefined {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return undefined
  const val = parseInt(process.argv[idx + 1], 10)
  if (isNaN(val) || val < 1) {
    console.error(`Invalid ${flag} value. Must be a positive integer.`)
    process.exit(1)
  }
  return val
}

loadEnv()

async function writeReport(report: import('./types').EvalReport): Promise<void> {
  const { generateConsoleReport, generateMarkdownReport } = await import('./report')
  const fs = await import('node:fs/promises')

  console.log(generateConsoleReport(report))

  const serializeMap = (m: ReadonlyMap<string, unknown>) => Object.fromEntries(m)
  const jsonPath = `eval/results-qa-${report.timestamp.replace(/:/g, '-')}.json`
  const serializable = {
    ...report,
    multiAgent: { ...report.multiAgent, perEventType: serializeMap(report.multiAgent.perEventType) },
    singleAgent: { ...report.singleAgent, perEventType: serializeMap(report.singleAgent.perEventType) },
    pro25SingleAgent: { ...report.pro25SingleAgent, perEventType: serializeMap(report.pro25SingleAgent.perEventType) },
    tradingAgents: { ...report.tradingAgents, perEventType: serializeMap(report.tradingAgents.perEventType) },
    results: report.results.map((r) => ({
      ...r,
      multiAgent: { ...r.multiAgent, holdingDirections: serializeMap(r.multiAgent.holdingDirections) },
      singleAgent: { ...r.singleAgent, holdingDirections: serializeMap(r.singleAgent.holdingDirections) },
      pro25SingleAgent: { ...r.pro25SingleAgent, holdingDirections: serializeMap(r.pro25SingleAgent.holdingDirections) },
      tradingAgents: { ...r.tradingAgents, holdingDirections: serializeMap(r.tradingAgents.holdingDirections) },
    })),
  }
  await fs.writeFile(jsonPath, JSON.stringify(serializable, null, 2), 'utf-8')
  console.log(`\nJSON results written to ${jsonPath}`)

  const markdownReport = generateMarkdownReport(report)
  await fs.writeFile('eval/REPORT.md', markdownReport, 'utf-8')
  console.log('Markdown report written to eval/REPORT.md')
}

async function run(): Promise<void> {
  const rejudgeIdx = process.argv.indexOf('--rejudge')
  const concurrency = parseIntArg('--concurrency')

  if (rejudgeIdx !== -1) {
    const inputPath = process.argv[rejudgeIdx + 1]
    if (!inputPath || inputPath.startsWith('--')) {
      console.error('Usage: npx tsx eval/run.ts --rejudge <results.json> [--concurrency N]')
      process.exit(1)
    }

    const { rejudge } = await import('./harness')

    console.log(`Re-judging from: ${inputPath}`)
    if (concurrency) console.log(`Concurrency: ${concurrency}`)
    console.log('')

    const report = await rejudge(inputPath, { concurrency })
    await writeReport(report)
  } else {
    const { runEvaluation } = await import('./harness')

    const limit = parseIntArg('--limit')
    const skipTradingAgents = process.argv.includes('--skip-tradingagents')
    const parallel = concurrency !== undefined && concurrency > 1
    console.log('Starting Prism 4-way evaluation harness...')
    if (limit) console.log(`Limit: ${limit} events`)
    if (concurrency) console.log(`Concurrency: ${concurrency}`)
    if (skipTradingAgents) console.log('Skipping TradingAgents')
    console.log('')

    const report = await runEvaluation({ parallel, concurrency, limit, skipTradingAgents })
    await writeReport(report)
  }
}

run().catch((error) => {
  console.error('Evaluation failed:', error)
  process.exit(1)
})
