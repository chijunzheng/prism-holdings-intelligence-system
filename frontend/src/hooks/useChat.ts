import { useCallback, useEffect, useRef, useState } from 'react'
import type { CausalChain, CausalChainNode, Signal } from '@prism/shared'
import type { TemporalAnalysis } from '../types/graph'

export interface ChatMessage {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly content: string
  readonly isStreaming?: boolean
}

interface UseChatOptions {
  readonly userId: string
  readonly node: CausalChainNode | null
  readonly chain: CausalChain | null
  readonly signal: Signal | null
  readonly temporalAnalysis: TemporalAnalysis | null
}

interface UseChatReturn {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly isLoading: boolean
  readonly error: string | null
  readonly sendMessage: (content: string) => void
}

let messageIdCounter = 0
function nextMessageId(): string {
  messageIdCounter += 1
  return `msg-${messageIdCounter}`
}

export function useChat({
  userId,
  node,
  chain,
  signal,
  temporalAnalysis,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ReadonlyArray<ChatMessage>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Reset chat when node changes
  useEffect(() => {
    abortControllerRef.current?.abort()
    setMessages([])
    setError(null)
    setIsLoading(false)

    if (!node || !chain || !signal || !temporalAnalysis) return

    setIsLoading(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    fetch(`/api/chat/${userId}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node, chain, signal, temporalAnalysis }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((payload: { success: boolean; data?: { content: string }; error?: string }) => {
        if (!payload.success || !payload.data) {
          throw new Error(payload.error ?? 'Failed to initialize chat')
        }
        setMessages([
          { id: nextMessageId(), role: 'assistant', content: payload.data.content },
        ])
        setIsLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [node?.id, chain?.id, signal?.id, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    (content: string) => {
      if (!node || !chain || !signal || !temporalAnalysis || isLoading) return

      const userMsg: ChatMessage = { id: nextMessageId(), role: 'user', content }
      const assistantId = nextMessageId()

      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', isStreaming: true },
      ])
      setIsLoading(true)
      setError(null)

      const controller = new AbortController()
      abortControllerRef.current = controller

      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      fetch(`/api/chat/${userId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node,
          chain,
          signal,
          temporalAnalysis,
          history,
          message: content,
        }),
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            const payload = await res.json()
            throw new Error((payload as { error?: string }).error ?? 'Chat request failed')
          }

          const reader = res.body?.getReader()
          if (!reader) throw new Error('No response stream')

          const decoder = new TextDecoder()
          let accumulated = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const text = decoder.decode(value, { stream: true })
            const lines = text.split('\n')

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data) as { text: string }
                accumulated += parsed.text
                const snapshot = accumulated
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: snapshot, isStreaming: true }
                      : m,
                  ),
                )
              } catch {
                // Skip malformed SSE chunks
              }
            }
          }

          // Mark streaming complete
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            ),
          )
          setIsLoading(false)
        })
        .catch((err: Error) => {
          if (err.name === 'AbortError') return
          setError(err.message)
          setIsLoading(false)
          // Remove the empty assistant message on error
          setMessages((prev) => prev.filter((m) => m.id !== assistantId))
        })
    },
    [chain, isLoading, messages, node, signal, temporalAnalysis, userId],
  )

  return { messages, isLoading, error, sendMessage }
}
