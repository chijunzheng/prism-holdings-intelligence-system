import { ChatGoogleGenerativeAI, type GoogleGenerativeAIChatInput } from '@langchain/google-genai'
import { getGeminiApiKey } from './env'

type GeminiChatModelOptions = Omit<GoogleGenerativeAIChatInput, 'apiKey'>

export function createGeminiChatModel(options: GeminiChatModelOptions): ChatGoogleGenerativeAI {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in .env.')
  }

  return new ChatGoogleGenerativeAI({
    ...options,
    apiKey,
  })
}
