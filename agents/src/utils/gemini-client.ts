// Singleton GoogleGenAI client — avoids re-instantiation overhead (~100-300ms)
// on every LLM call. Reuses HTTP keep-alive connections across calls.

import { GoogleGenAI } from '@google/genai'
import { getGeminiApiKey } from './env'

let _instance: GoogleGenAI | null = null

export function getGeminiClient(): GoogleGenAI {
  if (!_instance) {
    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.')
    }
    _instance = new GoogleGenAI({ apiKey })
  }
  return _instance
}
