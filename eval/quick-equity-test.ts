// Quick 2-event single-equity test: TradingAgents vs Single-Agent Gemini
// Tests whether TA outperforms vanilla Gemini on stock-specific catalysts (TA's home turf).
//
// Usage: npx tsx eval/quick-equity-test.ts

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env before any imports that need API keys
function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env')
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx < 0) continue
      process.env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
    }
  } catch { /* no .env file */ }
  if (!process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY
  }
}
loadEnv()

import { createGeminiChatModel } from '../agents/src/utils/gemini-chat-model'

// ── Test Events ──────────────────────────────────────────────

interface EquityEvent {
  readonly id: string
  readonly ticker: string
  readonly date: string
  readonly eventDescription: string
  readonly groundTruth: 'positive' | 'negative'
}

const EVENTS: readonly EquityEvent[] = [
  {
    id: 'nvda-earnings-2024-05',
    ticker: 'NVDA',
    date: '2024-05-22',
    eventDescription:
      'NVIDIA reported Q1 FY2025 earnings. Revenue $26.0B vs $24.6B expected (+18% beat). ' +
      'Data center revenue $22.6B, up 427% YoY. EPS $6.12 vs $5.59 expected. ' +
      'Raised Q2 guidance above consensus. Announced 10-for-1 stock split.',
    groundTruth: 'positive',
  },
  {
    id: 'meta-earnings-2022-10',
    ticker: 'META',
    date: '2022-10-26',
    eventDescription:
      'Meta Platforms reported Q3 2022 earnings. Revenue $27.7B vs $27.4B expected but down 4% YoY ' +
      '(first-ever revenue decline). Reality Labs lost $3.7B ($9.4B YTD). ' +
      'Q4 guidance $30-32.5B below $32.2B consensus. 2023 capex $34-39B for metaverse investment.',
    groundTruth: 'negative',
  },
]

// ── TradingAgents Runner ──────────────────────────────────────

const PYTHON_PATH = '/tmp/TradingAgents/.venv/bin/python3'
const BRIDGE_PATH = resolve(__dirname, 'tradingagents/bridge.py')
const TIMEOUT_MS = 15 * 60 * 1000

interface BridgeResponse {
  readonly signal: 'BUY' | 'SELL' | 'HOLD'
  readonly reasoning: string
}

interface BridgeError {
  readonly error: string
}

function runTradingAgents(
  ticker: string,
  date: string,
  eventContext: string,
): Promise<{ direction: 'positive' | 'negative' | 'mixed'; reasoning: string }> {
  return new Promise((res, reject) => {
    const args = [
      BRIDGE_PATH,
      '--ticker', ticker,
      '--date', date,
      '--model', 'gemini-2.5-flash',
      '--event-context', eventContext,
    ]

    execFile(PYTHON_PATH, args, { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      const trimmed = stdout.trim()
      if (!trimmed) {
        reject(new Error(`TradingAgents produced no output: ${error?.message}`))
        return
      }

      const parsed: BridgeResponse | BridgeError = JSON.parse(trimmed)
      if ('error' in parsed) {
        reject(new Error(`TradingAgents error: ${parsed.error}`))
        return
      }

      const dirMap = { BUY: 'positive', SELL: 'negative', HOLD: 'mixed' } as const
      res({ direction: dirMap[parsed.signal], reasoning: parsed.reasoning })
    })
  })
}

// ── Single-Agent Gemini Runner ────────────────────────────────

async function runSingleAgent(
  ticker: string,
  date: string,
  eventDescription: string,
  model: string,
): Promise<{ direction: 'positive' | 'negative' | 'mixed'; reasoning: string }> {
  const llm = createGeminiChatModel({ model, temperature: 0.3 })

  const systemPrompt = `You are a financial analyst specializing in single-stock analysis.
Given a stock catalyst event, predict the 5-trading-day directional impact on the stock.

Respond ONLY with valid JSON:
{
  "direction": "positive" | "negative" | "mixed",
  "reasoning": "2-3 sentence explanation of your prediction"
}`

  const userPrompt = `Stock: ${ticker}
Date: ${date}
Event: ${eventDescription}

Predict the 5-trading-day direction for ${ticker} following this event.`

  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ])

  const text = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content)

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { direction: 'mixed', reasoning: 'Failed to parse response' }
  }

  const parsed = JSON.parse(jsonMatch[0])
  return { direction: parsed.direction, reasoning: parsed.reasoning }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  console.log('=== Quick Single-Equity Test: TA vs Vanilla Gemini ===\n')

  for (const event of EVENTS) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`Event: ${event.id} | ${event.ticker} @ ${event.date}`)
    console.log(`Ground truth: ${event.groundTruth}`)
    console.log(`${'─'.repeat(60)}`)

    const skipTA = process.argv.includes('--skip-ta')

    const t0 = Date.now()

    const promises: readonly [
      Promise<{ direction: string; reasoning: string }>,
      Promise<{ direction: string; reasoning: string }>,
      Promise<{ direction: string; reasoning: string }>,
    ] = [
      skipTA
        ? Promise.reject(new Error('skipped'))
        : runTradingAgents(event.ticker, event.date, event.eventDescription),
      runSingleAgent(event.ticker, event.date, event.eventDescription, 'gemini-2.5-flash'),
      runSingleAgent(event.ticker, event.date, event.eventDescription, 'gemini-2.5-pro'),
    ]

    const [taResult, flashResult, proResult] = await Promise.allSettled(promises)

    const elapsed = Math.round((Date.now() - t0) / 1000)

    // Print results
    const systems = [
      { name: 'TradingAgents', result: taResult },
      { name: 'Gemini 2.5 Flash', result: flashResult },
      { name: 'Gemini 2.5 Pro', result: proResult },
    ]

    for (const { name, result } of systems) {
      if (result.status === 'fulfilled') {
        const correct = result.value.direction === event.groundTruth
          || (result.value.direction === 'mixed' && event.groundTruth === 'positive') // partial credit
        const icon = result.value.direction === event.groundTruth ? '  CORRECT' : '  WRONG'
        console.log(`\n[${name}] → ${result.value.direction}${icon}`)
        console.log(`  Reasoning: ${result.value.reasoning.slice(0, 300)}`)
      } else {
        console.log(`\n[${name}] → FAILED: ${result.reason}`)
      }
    }

    console.log(`\n  (${elapsed}s elapsed)`)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('Done.')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
