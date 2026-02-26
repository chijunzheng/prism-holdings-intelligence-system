import { GoogleGenAI } from '@google/genai'
import type { Signal, ExposureMap, CausalChain } from '@prism/shared'
import type { AgentConfig, AgentResult } from '../types'
import { buildCausalChainPrompt, buildRetryPrompt } from './prompts'
import { validateCausalChain } from './validate'
import { getCausalPropagationModelName, getGeminiApiKey } from '../utils/env'

export const config: AgentConfig = {
  name: 'causal-propagation',
  description: 'Multi-hop causal chain generation as structured JSON',
  usesLlm: true,
}

const MAX_RETRIES = 1

/**
 * Generates a causal propagation chain from a signal event
 * through the user's specific exposure profile.
 */
export async function propagate(
  signal: Signal,
  exposureMap: ExposureMap,
): Promise<AgentResult<CausalChain>> {
  const start = performance.now()

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
    const modelName = getCausalPropagationModelName()
    const basePrompt = buildCausalChainPrompt(signal, exposureMap)

    let currentPrompt = basePrompt
    let lastErrors: ReadonlyArray<string> = []

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await genai.models.generateContent({
        model: modelName,
        contents: currentPrompt,
        config: {
          temperature: 0.4,
        },
      })

      const responseText = response.text ?? ''
      const result = validateCausalChain(responseText)

      if (result.success && result.chain) {
        return {
          success: true,
          data: result.chain,
          durationMs: performance.now() - start,
        }
      }

      // Prepare corrective retry prompt
      lastErrors = result.errors ?? ['Unknown validation error']
      currentPrompt = buildRetryPrompt(basePrompt, lastErrors)
    }

    return {
      success: false,
      error: `Failed after ${MAX_RETRIES + 1} attempts. Last errors: ${lastErrors.join('; ')}`,
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
