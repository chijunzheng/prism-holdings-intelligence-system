import { InMemoryRunner, isFinalResponse, stringifyContent } from '@google/adk'
import { createUserContent } from '@google/genai'
import type { AgentResult } from '../types'
import { ensureAdkEnvironment, hasAdkApiKey } from './env'
import { prismAdkRootAgent } from './root-agent'

const PRISM_ADK_APP_NAME = 'prism_adk'
const runner = new InMemoryRunner({
  appName: PRISM_ADK_APP_NAME,
  agent: prismAdkRootAgent,
})

export interface AdkPromptRequest {
  readonly message: string
  readonly userId: string
  readonly sessionId?: string
}

export interface AdkPromptResponse {
  readonly sessionId: string
  readonly response: string
  readonly eventCount: number
}

async function resolveSessionId(userId: string, sessionId?: string): Promise<string> {
  if (sessionId) {
    const existing = await runner.sessionService.getSession({
      appName: PRISM_ADK_APP_NAME,
      userId,
      sessionId,
    })
    if (existing) return existing.id
  }

  const created = await runner.sessionService.createSession({
    appName: PRISM_ADK_APP_NAME,
    userId,
  })
  return created.id
}

export async function runPrismAdkPrompt(
  request: AdkPromptRequest,
): Promise<AgentResult<AdkPromptResponse>> {
  const start = performance.now()
  ensureAdkEnvironment()

  const message = request.message.trim()
  const userId = request.userId.trim()

  if (!message) {
    return {
      success: false,
      error: 'Message is required',
      durationMs: performance.now() - start,
    }
  }

  if (!userId) {
    return {
      success: false,
      error: 'User id is required',
      durationMs: performance.now() - start,
    }
  }

  if (!hasAdkApiKey()) {
    return {
      success: false,
      error: 'GOOGLE_API_KEY (or GEMINI_API_KEY) is required for ADK runtime',
      durationMs: performance.now() - start,
    }
  }

  try {
    const resolvedSessionId = await resolveSessionId(userId, request.sessionId)
    const userMessage = createUserContent(message)

    let finalText = ''
    let eventCount = 0

    for await (const event of runner.runAsync({
      userId,
      sessionId: resolvedSessionId,
      newMessage: userMessage,
    })) {
      eventCount += 1
      if (isFinalResponse(event)) {
        const text = stringifyContent(event).trim()
        if (text) finalText = text
      }
    }

    return {
      success: true,
      data: {
        sessionId: resolvedSessionId,
        response: finalText || 'No final response was generated.',
        eventCount,
      },
      durationMs: performance.now() - start,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown ADK runtime error',
      durationMs: performance.now() - start,
    }
  }
}
