import { GoogleGenAI } from '@google/genai'
import type { ExposureMap, Signal } from '@prism/shared'
import { MAX_SIGNAL_MONITOR_RESULTS } from '@prism/shared'
import type { AgentConfig, AgentResult } from '../types'
import { buildSignalSearchPrompt } from './prompts'
import { parseSignalResponseWithDiagnostics, deduplicateSignals } from './parse'
import { getGeminiApiKey, getSignalMonitorModelName } from '../utils/env'

export const config: AgentConfig = {
  name: 'signal-monitor',
  description: 'Queries Gemini with Google Search grounding for live market events',
  usesLlm: true,
}

/** Cache to avoid hitting Gemini on every request (15-min TTL) */
let signalCache: { signals: ReadonlyArray<Signal>; timestamp: number } | null = null
const CACHE_TTL_MS = 15 * 60 * 1000
const EMPTY_CACHE_TTL_MS = 60 * 1000

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const TRACE_SIGNAL_MONITOR =
  isTruthyEnv(process.env.DEBUG_IMPACT_TRACE) || isTruthyEnv(process.env.PRISM_TRACE)
const TRACE_SIGNAL_MONITOR_VERBOSE =
  TRACE_SIGNAL_MONITOR ||
  isTruthyEnv(process.env.PRISM_TRACE_LLM) ||
  isTruthyEnv(process.env.DEBUG_SIGNAL_MONITOR_VERBOSE)

function traceSignalMonitor(scope: string, payload: Record<string, unknown>): void {
  if (!TRACE_SIGNAL_MONITOR) return
  // eslint-disable-next-line no-console
  console.log(`[PrismTrace][signal-monitor:${scope}]`, payload)
}

function traceSignalMonitorVerbose(scope: string, payload: Record<string, unknown>): void {
  if (!TRACE_SIGNAL_MONITOR_VERBOSE) return
  // eslint-disable-next-line no-console
  console.log(`[PrismTrace][signal-monitor:${scope}]`, payload)
}

function compactTextSnippet(value: string, maxLength = 360): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength - 1)}…`
}

function getCacheTtlMs(signalCount: number): number {
  return signalCount > 0 ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS
}

/**
 * Monitors live market events relevant to the user's exposure profile.
 * Uses Gemini with Google Search grounding for real-time signal detection.
 */
export async function monitor(
  exposureMap: ExposureMap,
): Promise<AgentResult<ReadonlyArray<Signal>>> {
  const start = performance.now()

  // Return cached signals if fresh
  if (signalCache && Date.now() - signalCache.timestamp < getCacheTtlMs(signalCache.signals.length)) {
    traceSignalMonitor('cache-hit', {
      signalCount: signalCache.signals.length,
      ageMs: Math.round(Date.now() - signalCache.timestamp),
    })
    return {
      success: true,
      data: signalCache.signals,
      durationMs: performance.now() - start,
    }
  }

  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return {
      success: false,
      error: 'Gemini API key not configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.',
      durationMs: performance.now() - start,
    }
  }

  try {
    const genai = new GoogleGenAI({ apiKey })

    const prompt = buildSignalSearchPrompt(exposureMap.exposures)
    const modelName = getSignalMonitorModelName()
    traceSignalMonitor('generate-start', {
      modelName,
      topExposures: exposureMap.exposures.slice(0, 3).map((e) => e.category),
      exposureCount: exposureMap.exposures.length,
    })
    traceSignalMonitorVerbose('llm-request', {
      modelName,
      promptChars: prompt.length,
      promptPreview: compactTextSnippet(prompt, 420),
    })

    const response = await genai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
      },
    })

    const responseText = response.text ?? ''
    const parsedResult = parseSignalResponseWithDiagnostics(responseText)
    const parsed = parsedResult.signals
    const deduped = deduplicateSignals(parsed)

    // Return up to configured max candidate signals.
    const signals = deduped.slice(0, MAX_SIGNAL_MONITOR_RESULTS)
    traceSignalMonitor('generate-finish', {
      responseChars: parsedResult.diagnostics.responseChars,
      parsedCount: parsedResult.diagnostics.acceptedCount,
      dedupedCount: deduped.length,
      returnedCount: signals.length,
      parseDiagnostics: parsedResult.diagnostics,
      durationMs: Math.round(performance.now() - start),
    })
    traceSignalMonitorVerbose('llm-response', {
      responseChars: responseText.length,
      responsePreview: compactTextSnippet(responseText, 520),
      parseDiagnostics: parsedResult.diagnostics,
    })
    if (signals.length === 0) {
      traceSignalMonitor('empty-signals', {
        reason: 'llm-parse-produced-no-valid-signals',
        parseDiagnostics: parsedResult.diagnostics,
      })
    }

    // Update cache
    signalCache = { signals, timestamp: Date.now() }

    return {
      success: true,
      data: signals,
      durationMs: performance.now() - start,
    }
  } catch (error) {
    traceSignalMonitor('generate-error', {
      error: error instanceof Error ? error.message : 'Gemini API error',
      durationMs: Math.round(performance.now() - start),
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gemini API error',
      durationMs: performance.now() - start,
    }
  }
}

/** Clears the signal cache (useful for testing or forced refresh) */
export function clearCache(): void {
  signalCache = null
}
