import { GoogleGenAI } from '@google/genai'
import type { ExposureMap, Signal } from '@prism/shared'
import { MAX_SIGNAL_MONITOR_RESULTS } from '@prism/shared'
import type { AgentConfig, AgentResult } from '../types'
import { buildSignalSearchPrompt } from './prompts'
import { parseSignalResponse, deduplicateSignals } from './parse'
import { getGeminiApiKey } from '../utils/env'

export const config: AgentConfig = {
  name: 'signal-monitor',
  description: 'Queries Gemini with Google Search grounding for live market events',
  usesLlm: true,
}

/** Cache to avoid hitting Gemini on every request (15-min TTL) */
let signalCache: { signals: ReadonlyArray<Signal>; timestamp: number } | null = null
const CACHE_TTL_MS = 15 * 60 * 1000

/**
 * Monitors live market events relevant to the user's exposure profile.
 * Uses Gemini with Google Search grounding for real-time signal detection.
 */
export async function monitor(
  exposureMap: ExposureMap,
): Promise<AgentResult<ReadonlyArray<Signal>>> {
  const start = performance.now()

  // Return cached signals if fresh
  if (signalCache && Date.now() - signalCache.timestamp < CACHE_TTL_MS) {
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

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.3,
      },
    })

    const responseText = response.text ?? ''
    const parsed = parseSignalResponse(responseText)
    const deduped = deduplicateSignals(parsed)

    // Return up to 5 candidate signals; UI decides how many cards to show.
    const signals = deduped.slice(0, MAX_SIGNAL_MONITOR_RESULTS)

    // Update cache
    signalCache = { signals, timestamp: Date.now() }

    return {
      success: true,
      data: signals,
      durationMs: performance.now() - start,
    }
  } catch (error) {
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
