import { getGeminiApiKey, getGeminiModelName } from '../utils/env'

export function ensureAdkEnvironment(): void {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return

  // ADK runtime uses GOOGLE_API_KEY. Keep it aligned to GEMINI key value.
  if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY !== apiKey) {
    process.env.GOOGLE_API_KEY = apiKey
  }

  // Avoid SDK warning: "Both GOOGLE_API_KEY and GEMINI_API_KEY are set..."
  // Non-ADK code still resolves key via getGeminiApiKey() fallback.
  if (process.env.GEMINI_API_KEY) {
    delete process.env.GEMINI_API_KEY
  }
}

export function hasAdkApiKey(): boolean {
  ensureAdkEnvironment()
  return Boolean(process.env.GOOGLE_API_KEY?.trim())
}

export function getAdkModelName(): string {
  return getGeminiModelName()
}
