// useUnifiedChat — replaces the split between askPrism chat and inline pipeline logic.
// Sends all messages through POST /api/v2/chat and handles the polymorphic SSE response.

import { useCallback, useRef } from 'react'
import type { StructuredResponseData, RouteDecisionEvent } from '@prism/shared'

export type SseEvent = {
  readonly event: string
  readonly data: unknown
}

export type ChatChunkData = {
  readonly text?: string
  readonly replaceText?: string
  readonly structured?: StructuredResponseData
  readonly suggestions?: string[]
  readonly thinkingText?: string
}

export type UnifiedChatCallbacks = {
  readonly onRouteDecision: (decision: RouteDecisionEvent) => void
  readonly onChatThinking: (data: ChatChunkData) => void
  readonly onChatChunk: (data: ChatChunkData) => void
  readonly onChatStructured: (data: ChatChunkData) => void
  readonly onChatComplete: () => void
  readonly onPipelineProgress: (stage: string, data: unknown) => void
  readonly onAgentThinking: (data: { stage?: string; text?: string }) => void
  readonly onCheckpoint: (data: { stage: string; type: 'hard' | 'soft'; [key: string]: unknown }) => void
  readonly onThreadId: (threadId: string) => void
  readonly onImpactDelta: (data: unknown) => void
  readonly onPlaybook: (data: unknown) => void
  readonly onTraceStep: (data: unknown) => void
  readonly onComplete: (data: unknown) => void
  readonly onError: (message: string) => void
}

async function* parseSseStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<SseEvent> {
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = ''
  let currentData = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line === '' && currentData) {
        try {
          const data = JSON.parse(currentData) as unknown
          yield { event: currentEvent || 'message', data }
        } catch {
          // Skip malformed JSON
        }
        currentEvent = ''
        currentData = ''
      } else if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        currentData += (currentData ? '\n' : '') + line.slice(6)
      }
    }
  }

  if (currentData) {
    try {
      const data = JSON.parse(currentData) as unknown
      yield { event: currentEvent || 'message', data }
    } catch {
      // Skip
    }
  }
}

export function useUnifiedChat(userId: string) {
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(
    async (
      message: string,
      history: readonly { role: string; content: string }[],
      callbacks: UnifiedChatCallbacks,
    ) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/v2/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ userId, message, history }),
        })

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
          callbacks.onError(errorBody.error ?? `Request failed: ${res.status}`)
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          callbacks.onError('No response stream')
          return
        }

        for await (const sseEvent of parseSseStream(reader)) {
          if (controller.signal.aborted) break

          switch (sseEvent.event) {
            case 'route_decision':
              callbacks.onRouteDecision(sseEvent.data as RouteDecisionEvent)
              break

            // Chat events
            case 'chat_thinking':
              callbacks.onChatThinking(sseEvent.data as ChatChunkData)
              break
            case 'chat_chunk':
              callbacks.onChatChunk(sseEvent.data as ChatChunkData)
              break
            case 'chat_structured':
              callbacks.onChatStructured(sseEvent.data as ChatChunkData)
              break
            case 'chat_complete':
              callbacks.onChatComplete()
              break

            // Checkpoint events
            case 'thread_id':
              callbacks.onThreadId((sseEvent.data as { threadId: string }).threadId)
              break
            case 'checkpoint':
              callbacks.onCheckpoint(sseEvent.data as { stage: string; type: 'hard' | 'soft'; [key: string]: unknown })
              break

            // Pipeline events
            case 'impact_delta':
              callbacks.onImpactDelta(sseEvent.data)
              break
            case 'playbook':
              callbacks.onPlaybook(sseEvent.data)
              break
            case 'trace_step':
              callbacks.onTraceStep(sseEvent.data)
              break
            case 'complete':
              callbacks.onComplete(sseEvent.data)
              break
            case 'agent_thinking':
              callbacks.onAgentThinking(sseEvent.data as { stage?: string; text?: string })
              break
            case 'error':
              callbacks.onError((sseEvent.data as { message?: string }).message ?? 'Unknown error')
              break

            // Pipeline progress stages (risk_profile, analyst_complete, etc.)
            default:
              callbacks.onPipelineProgress(sseEvent.event, sseEvent.data)
              break
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        callbacks.onError(error instanceof Error ? error.message : 'Unknown error')
      }
    },
    [userId],
  )

  const abort = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  return { sendMessage, abort }
}
