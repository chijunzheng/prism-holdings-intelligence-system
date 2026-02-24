/**
 * Returns the Gemini API key from supported env var names.
 * Accepts GEMINI_API_KEY (preferred) and GOOGLE_API_KEY (fallback).
 */
export function getGeminiApiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
  if (!raw) return null

  const key = raw.trim()
  if (!key) return null

  // Guard against common placeholder values copied from .env.example.
  if (key.toLowerCase().includes('your_gemini_api_key_here')) return null
  if (key.toLowerCase() === 'your_api_key_here') return null

  return key
}
