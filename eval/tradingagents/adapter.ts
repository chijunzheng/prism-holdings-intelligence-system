// TypeScript adapter — spawns the Python bridge and returns a BaselineResult.
// TradingAgents takes (ticker, date) for a single stock. We run on SPY for all events
// as the broadest market proxy matching our portfolio-level direction analysis.

import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import type { BaselineResult } from '../types'

// ── Constants ──────────────────────────────────────────────

/** TradingAgents venv Python path */
const PYTHON_PATH = '/tmp/TradingAgents/.venv/bin/python3'

/** Bridge script path */
const BRIDGE_PATH = resolve(__dirname, 'bridge.py')

/** Default ticker — SPY is the broadest market proxy */
const DEFAULT_TICKER = 'SPY'

/** Timeout per event: 15 minutes (TradingAgents runs multiple agent rounds with tool calls) */
const TIMEOUT_MS = 15 * 60 * 1000

/** Wide fallback range — TradingAgents doesn't produce dollar estimates */
const FALLBACK_DOLLAR_RANGE = { low: -5000, high: 5000 } as const

// ── Bridge Response Type ──────────────────────────────────

interface BridgeResponse {
  readonly signal: 'BUY' | 'SELL' | 'HOLD'
  readonly reasoning: string
  readonly reports: Record<string, string>
}

interface BridgeError {
  readonly error: string
}

// ── Direction Mapping ─────────────────────────────────────

function mapSignalToDirection(signal: 'BUY' | 'SELL' | 'HOLD'): 'positive' | 'negative' | 'mixed' {
  switch (signal) {
    case 'BUY': return 'positive'
    case 'SELL': return 'negative'
    case 'HOLD': return 'mixed'
  }
}

// ── Spawn Helper ──────────────────────────────────────────

function spawnBridge(
  ticker: string,
  date: string,
  model: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      BRIDGE_PATH,
      '--ticker', ticker,
      '--date', date,
      '--model', model,
    ]

    execFile(PYTHON_PATH, args, { timeout: TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (stderr) {
        // TradingAgents logs to stderr — expected, not an error
        const preview = stderr.split('\n').filter((l: string) => !l.includes('GOOGLE_API_KEY')).slice(-3).join(' | ')
        if (preview.trim()) {
          console.log(`  [TradingAgents stderr] ${preview.slice(0, 300)}`)
        }
      }

      // Bridge writes JSON to stdout even on failure (exit code 1).
      // Prefer stdout over the execFile error so we get structured error messages.
      const trimmed = stdout.trim()
      if (trimmed) {
        resolve(trimmed)
        return
      }

      if (error) {
        reject(new Error(`TradingAgents bridge failed: ${error.message}`))
        return
      }

      resolve(trimmed)
    })
  })
}

// ── Public API ────────────────────────────────────────────

export async function runTradingAgentsForEvent(
  eventId: string,
  date: string,
  model: string = 'gemini-3-flash-preview',
): Promise<BaselineResult> {
  console.log(`  [TradingAgents] Running for ${eventId} (${DEFAULT_TICKER} @ ${date})...`)

  const rawOutput = await spawnBridge(DEFAULT_TICKER, date, model)

  // Parse JSON from stdout
  const parsed: BridgeResponse | BridgeError = JSON.parse(rawOutput)

  if ('error' in parsed) {
    throw new Error(`TradingAgents returned error: ${parsed.error}`)
  }

  const direction = mapSignalToDirection(parsed.signal)

  return {
    direction,
    dollarImpactRange: FALLBACK_DOLLAR_RANGE,
    holdingDirections: new Map(),
    reasoning: parsed.reasoning,
  }
}
