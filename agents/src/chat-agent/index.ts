import { GoogleGenAI } from '@google/genai'
import type { AgentConfig } from '../types'
import { getGeminiApiKey } from '../utils/env'
import { buildSystemPrompt, buildNodeContextPrompt, buildWhatIfDetectionPrompt } from './prompts'
import type { ChatContext, ChatMessage, WhatIfDetection } from './types'

export const config: AgentConfig = {
  name: 'chat-agent',
  description: 'Contextual chat agent scoped to a selected causal graph node',
  usesLlm: true,
}

/**
 * Generates the initial context message when a node is selected.
 */
export async function generateInitialMessage(
  context: ChatContext,
): Promise<{ readonly content: string; readonly error?: string }> {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return { content: '', error: 'Gemini API key not configured.' }
  }

  try {
    const genai = new GoogleGenAI({ apiKey })
    const systemPrompt = buildSystemPrompt(context.profile)
    const contextPrompt = buildNodeContextPrompt(
      context.node,
      context.chain,
      context.exposureMap,
      context.signal,
      context.temporalAnalysis,
    )

    const response = await genai.models.generateContent({
      model: 'gemini-3.0-pro-preview',
      contents: contextPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.5,
      },
    })

    return { content: response.text ?? '' }
  } catch (error) {
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Failed to generate initial message',
    }
  }
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
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    yield 'Error: Gemini API key not configured.'
    return
  }

  try {
    const genai = new GoogleGenAI({ apiKey })
    const systemPrompt = buildSystemPrompt(context.profile)

    // Build conversation history for Gemini
    const contents = [
      ...history.map((msg) => ({
        role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user' as const,
        parts: [{ text: userMessage }],
      },
    ]

    const response = await genai.models.generateContentStream({
      model: 'gemini-3.0-pro-preview',
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.5,
      },
    })

    for await (const chunk of response) {
      const text = chunk.text ?? ''
      if (text) {
        yield text
      }
    }
  } catch (error) {
    yield `Error: ${error instanceof Error ? error.message : 'Failed to generate response'}`
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
    const response = await genai.models.generateContent({
      model: 'gemini-3.0-pro-preview',
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

export type { ChatContext, ChatMessage, WhatIfDetection } from './types'
