import { getGeminiApiKey, getGeminiModelName } from '../utils/env'

export function ensureAdkEnvironment(): void {
  const apiKey = getGeminiApiKey()
  if (!apiKey) return

  // Keep all SDK aliases aligned so ADK + GenAI runtime paths resolve the same key.
  if (!process.env.GOOGLE_API_KEY || process.env.GOOGLE_API_KEY !== apiKey) {
    process.env.GOOGLE_API_KEY = apiKey
  }
  if (!process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_GENAI_API_KEY !== apiKey) {
    process.env.GOOGLE_GENAI_API_KEY = apiKey
  }
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY !== apiKey) {
    process.env.GEMINI_API_KEY = apiKey
  }
}

export function hasAdkApiKey(): boolean {
  ensureAdkEnvironment()
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_GENAI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim(),
  )
}

export function getAdkModelName(): string {
  return getGeminiModelName()
}
