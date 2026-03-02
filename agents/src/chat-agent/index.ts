import type { AgentConfig } from '../types'
import { getGeminiApiKey, getGeminiModelName } from '../utils/env'
import { getGeminiClient } from '../utils/gemini-client'

// Direct Gemini call — replaces the old ADK runtime.
async function runGeminiPrompt(params: {
  message: string
}): Promise<{ success: boolean; data?: { response: string }; error?: string }> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return { success: false, error: 'Gemini API key not configured' }
  }

  try {
    const genai = getGeminiClient()
    const response = await genai.models.generateContent({
      model: getGeminiModelName(),
      contents: params.message,
      config: { temperature: 0.7 },
    })

    const text = response.text ?? ''
    if (!text) {
      return { success: false, error: 'Empty response from Gemini' }
    }

    return { success: true, data: { response: text } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gemini call failed',
    }
  }
}
import { buildSystemPrompt, buildNodeContextPrompt, buildWhatIfDetectionPrompt } from './prompts'
import type { ChatContext, ChatMessage, WhatIfDetection } from './types'

export const config: AgentConfig = {
  name: 'chat-agent',
  description: 'Contextual chat agent scoped to a selected causal graph node via ADK runtime',
  usesLlm: true,
}

function buildInitialPrompt(context: ChatContext): string {
  const systemPrompt = buildSystemPrompt(context.profile)
  const contextPrompt = buildNodeContextPrompt(
    context.node,
    context.chain,
    context.exposureMap,
    context.signal,
    context.temporalAnalysis,
  )

  return [
    systemPrompt,
    '',
    'TASK:',
    'Generate the initial contextual explanation for this selected graph node.',
    'Keep it concise and specific to this user.',
    '',
    contextPrompt,
  ].join('\n')
}

function buildChatPrompt(
  context: ChatContext,
  history: ReadonlyArray<ChatMessage>,
  userMessage: string,
): string {
  const systemPrompt = buildSystemPrompt(context.profile)
  const contextPrompt = buildNodeContextPrompt(
    context.node,
    context.chain,
    context.exposureMap,
    context.signal,
    context.temporalAnalysis,
  )

  const transcript = history
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n')

  return [
    systemPrompt,
    '',
    'NODE CONTEXT:',
    contextPrompt,
    '',
    'CHAT HISTORY:',
    transcript || '(none)',
    '',
    `LATEST USER MESSAGE: ${userMessage}`,
    '',
    'Respond with practical analysis only. Avoid markdown headings.',
  ].join('\n')
}

function* chunkText(text: string, chunkSize = 96): Generator<string, void, undefined> {
  if (!text) return
  for (let index = 0; index < text.length; index += chunkSize) {
    yield text.slice(index, index + chunkSize)
  }
}

/**
 * Generates the initial context message when a node is selected.
 */
export async function generateInitialMessage(
  context: ChatContext,
): Promise<{ readonly content: string; readonly error?: string }> {
  if (!getGeminiApiKey()) {
    return { content: '', error: 'Gemini API key not configured.' }
  }

  const result = await runGeminiPrompt({
    message: buildInitialPrompt(context),
  })

  if (!result.success || !result.data) {
    return {
      content: '',
      error: result.error ?? 'Failed to generate initial message',
    }
  }

  return { content: result.data.response }
}

/**
 * Sends a user message and returns assistant response via streaming.
 * Returns an async generator that yields text chunks.
 */
export async function* streamChatResponse(
  context: ChatContext,
  history: ReadonlyArray<ChatMessage>,
  userMessage: string,
): AsyncGenerator<string, void, undefined> {
  if (!getGeminiApiKey()) {
    yield 'Error: Gemini API key not configured.'
    return
  }

  const result = await runGeminiPrompt({
    message: buildChatPrompt(context, history, userMessage),
  })

  if (!result.success || !result.data) {
    yield `Error: ${result.error ?? 'Failed to generate response'}`
    return
  }

  for (const chunk of chunkText(result.data.response)) {
    yield chunk
  }
}

/**
 * Detects whether a user message is a "what-if" question
 * that requires causal chain re-generation.
 */
export async function detectWhatIf(userMessage: string): Promise<WhatIfDetection> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return { isWhatIf: false, modifiedAssumption: null }
  }

  try {
    const genai = getGeminiClient()
    const modelName = getGeminiModelName()
    const response = await genai.models.generateContent({
      model: modelName,
      contents: buildWhatIfDetectionPrompt(userMessage),
      config: { temperature: 0 },
    })

    const text = response.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { isWhatIf: false, modifiedAssumption: null }
    }

    const parsed = JSON.parse(jsonMatch[0]) as WhatIfDetection
    return {
      isWhatIf: Boolean(parsed.isWhatIf),
      modifiedAssumption: parsed.modifiedAssumption ?? null,
    }
  } catch {
    return { isWhatIf: false, modifiedAssumption: null }
  }
}

/**
 * Generates the initial welcome message for general (non-contextual) chat.
 */
export async function generateGeneralInitialMessage(
  profile: import('@prism/shared').UserProfile,
  exposureMap: import('@prism/shared').ExposureMap,
): Promise<{ readonly content: string; readonly error?: string }> {
  if (!getGeminiApiKey()) {
    return { content: '', error: 'Gemini API key not configured.' }
  }

  const topExposures = exposureMap.exposures
    .slice(0, 5)
    .map((e) => `- ${e.category}: ${e.percentage.toFixed(1)}%`)
    .join('\n')

  const warnings = exposureMap.warnings
    .map((w) => `- ${w.message}`)
    .join('\n')

  const prompt = [
    buildSystemPrompt(profile),
    '',
    'TASK:',
    'The user has opened a general portfolio chat. Greet them and briefly summarize their portfolio exposure.',
    'Keep it concise (2-3 sentences). Include the disclaimer.',
    '',
    '## Portfolio Summary',
    `Top exposures:\n${topExposures}`,
    warnings ? `\nConcentration warnings:\n${warnings}` : '',
  ].join('\n')

  const result = await runGeminiPrompt({
    message: prompt,
  })

  if (!result.success || !result.data) {
    return {
      content: '',
      error: result.error ?? 'Failed to generate initial message',
    }
  }

  return { content: result.data.response }
}

/**
 * Streams a general chat response using portfolio/exposure context (no node/chain).
 */
export async function* streamGeneralChatResponse(
  profile: import('@prism/shared').UserProfile,
  exposureMap: import('@prism/shared').ExposureMap,
  history: ReadonlyArray<ChatMessage>,
  userMessage: string,
): AsyncGenerator<string, void, undefined> {
  if (!getGeminiApiKey()) {
    yield 'Error: Gemini API key not configured.'
    return
  }

  const topExposures = exposureMap.exposures
    .slice(0, 5)
    .map((e) => `- ${e.category}: ${e.percentage.toFixed(1)}%`)
    .join('\n')

  const transcript = history
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n')

  const prompt = [
    buildSystemPrompt(profile),
    '',
    '## Portfolio Context',
    `Top exposures:\n${topExposures}`,
    '',
    'CHAT HISTORY:',
    transcript || '(none)',
    '',
    `LATEST USER MESSAGE: ${userMessage}`,
    '',
    'Respond with practical analysis only. Avoid markdown headings.',
  ].join('\n')

  const result = await runGeminiPrompt({
    message: prompt,
  })

  if (!result.success || !result.data) {
    yield `Error: ${result.error ?? 'Failed to generate response'}`
    return
  }

  for (const chunk of chunkText(result.data.response)) {
    yield chunk
  }
}

/** Tagged chunk: discriminates between thinking tokens and response text. */
export type AskPrismChunk =
  | { readonly kind: 'thinking'; readonly text: string }
  | { readonly kind: 'text'; readonly text: string }

/**
 * Streams an Ask Prism chat response using the unified context with all available layers.
 * Uses Gemini's native streaming API with thinking enabled for true reasoning tokens.
 * Yields tagged chunks so callers can distinguish thinking from response text.
 */
export async function* streamAskPrismResponse(
  context: import('@prism/shared').AskPrismContext,
  history: ReadonlyArray<ChatMessage>,
  userMessage: string,
  _sessionScope: import('@prism/shared').AskPrismSessionScope = 'global',
  personalContextPrompt?: string,
): AsyncGenerator<AskPrismChunk, void, undefined> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    yield { kind: 'text', text: 'Error: Gemini API key not configured.' }
    return
  }

  const { buildAskPrismPrompt } = await import('./ask-prism-prompt')
  const contextPrompt = buildAskPrismPrompt(context, personalContextPrompt)

  const transcript = history
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.content}`)
    .join('\n')

  const prompt = [
    contextPrompt,
    '',
    'CHAT HISTORY:',
    transcript || '(none)',
    '',
    `LATEST USER MESSAGE: ${userMessage}`,
  ].join('\n')

  try {
    const genai = getGeminiClient()
    const stream = await genai.models.generateContentStream({
      model: getGeminiModelName(),
      contents: prompt,
      config: {
        temperature: 0.7,
        thinkingConfig: {
          includeThoughts: true,
        },
      },
    })

    for await (const chunk of stream) {
      // Extract parts directly to separate thinking from response text
      const parts = chunk.candidates?.[0]?.content?.parts
      if (parts) {
        for (const part of parts) {
          if (part.text) {
            yield { kind: part.thought ? 'thinking' : 'text', text: part.text }
          }
        }
      }
    }
  } catch (error) {
    yield { kind: 'text', text: `Error: ${error instanceof Error ? error.message : 'Gemini streaming call failed'}` }
  }
}

export type { ChatContext, ChatMessage, WhatIfDetection } from './types'
