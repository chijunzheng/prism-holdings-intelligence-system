/**
 * Returns the Gemini API key from supported env var names.
 * Accepts GEMINI_API_KEY (preferred), GOOGLE_GENAI_API_KEY, and GOOGLE_API_KEY.
 */
export function getGeminiApiKey(): string | null {
  const raw =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    process.env.GOOGLE_API_KEY
  if (!raw) return null

  const key = raw.trim()
  if (!key) return null

  // Guard against common placeholder values copied from .env.example.
  if (key.toLowerCase().includes('your_gemini_api_key_here')) return null
  if (key.toLowerCase() === 'your_api_key_here') return null

  return key
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_FAST_GEMINI_MODEL = 'gemini-2.5-flash-lite'

/**
 * Returns the Gemini model name from env with a safe default.
 * Priority: GEMINI_MODEL -> ADK_MODEL -> default.
 */
export function getGeminiModelName(): string {
  const candidates = [process.env.GEMINI_MODEL, process.env.ADK_MODEL, DEFAULT_GEMINI_MODEL]

  for (const candidate of candidates) {
    const model = candidate?.trim()
    if (model) return model
  }

  return DEFAULT_GEMINI_MODEL
}

/**
 * Returns a latency-optimized Gemini model name.
 * Priority: GEMINI_FAST_MODEL -> default.
 */
export function getGeminiFastModelName(): string {
  const candidates = [process.env.GEMINI_FAST_MODEL, DEFAULT_FAST_GEMINI_MODEL]

  for (const candidate of candidates) {
    const model = candidate?.trim()
    if (model) return model
  }

  return DEFAULT_FAST_GEMINI_MODEL
}

/**
 * Signal monitor model (latency-sensitive).
 * Priority: GEMINI_SIGNAL_MODEL -> fast model resolver.
 */
export function getSignalMonitorModelName(): string {
  const explicit = process.env.GEMINI_SIGNAL_MODEL?.trim()
  if (explicit) return explicit
  return getGeminiFastModelName()
}

/**
 * Causal propagation model (latency-sensitive).
 * Priority: GEMINI_CAUSAL_MODEL -> fast model resolver.
 */
export function getCausalPropagationModelName(): string {
  const explicit = process.env.GEMINI_CAUSAL_MODEL?.trim()
  if (explicit) return explicit
  return getGeminiFastModelName()
}
