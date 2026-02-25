import type { AgentConfig } from '../types'
import { runPrismAdkPrompt } from '../adk'
import { getGeminiApiKey, getGeminiModelName } from '../utils/env'
import { buildSystemPrompt, buildNodeContextPrompt, buildWhatIfDetectionPrompt } from './prompts'
import type { ChatContext, ChatMessage, WhatIfDetection } from './types'
import { GoogleGenAI } from '@google/genai'

export const config: AgentConfig = {
  name: 'chat-agent',
  description: 'Contextual chat agent scoped to a selected causal graph node via ADK runtime',
  usesLlm: true,
}

const CHAT_SESSION_PREFIX = 'chat'

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

  const result = await runPrismAdkPrompt({
    userId: context.profile.id,
    message: buildInitialPrompt(context),
    sessionId: `${CHAT_SESSION_PREFIX}:${context.profile.id}:${context.signal.id}:${context.node.id}:init`,
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

  const result = await runPrismAdkPrompt({
    userId: context.profile.id,
    message: buildChatPrompt(context, history, userMessage),
    sessionId: `${CHAT_SESSION_PREFIX}:${context.profile.id}:${context.signal.id}:${context.node.id}`,
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
    const genai = new GoogleGenAI({ apiKey })
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

  const result = await runPrismAdkPrompt({
    userId: profile.id,
    message: prompt,
    sessionId: `${CHAT_SESSION_PREFIX}:${profile.id}:general:init`,
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

  const result = await runPrismAdkPrompt({
    userId: profile.id,
    message: prompt,
    sessionId: `${CHAT_SESSION_PREFIX}:${profile.id}:general`,
  })

  if (!result.success || !result.data) {
    yield `Error: ${result.error ?? 'Failed to generate response'}`
    return
  }

  for (const chunk of chunkText(result.data.response)) {
    yield chunk
  }
}

export type { ChatContext, ChatMessage, WhatIfDetection } from './types'
