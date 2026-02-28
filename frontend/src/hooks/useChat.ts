import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AskPrismCopilotProposalResponse,
  AskPrismEntryContext,
  AskPrismPage,
  AskPrismPlanProposal,
  AskPrismSessionScope,
  CausalChain,
  CausalChainNode,
  PlanSelection,
  Signal,
  StrategyCandidate,
} from '@prism/shared'
import type { TemporalAnalysis } from '../types/graph'

export interface ChatMessage {
  readonly id: string
  readonly role: 'user' | 'assistant' | 'divider'
  readonly content: string
  readonly isStreaming?: boolean
  readonly planProposal?: AskPrismPlanProposal
  readonly suggestedFollowUps?: ReadonlyArray<string>
}

interface UseChatOptions {
  readonly userId: string
  readonly mode?: 'contextual' | 'general'
  readonly node?: CausalChainNode | null
  readonly chain?: CausalChain | null
  readonly signal?: Signal | null
  readonly temporalAnalysis?: TemporalAnalysis | null
}

// ── Ask Prism unified chat hook ──────────────────

interface AskPrismChatCache {
  readonly scopeKey: string
  readonly messages: ReadonlyArray<ChatMessage>
}

const askPrismCache = new Map<string, AskPrismChatCache>()

interface UseAskPrismChatOptions {
  readonly userId: string
  readonly page: AskPrismPage
  readonly signalId?: string
  readonly entryContext?: AskPrismEntryContext | null
  readonly planSelections?: ReadonlyArray<PlanSelection>
  readonly planCandidates?: ReadonlyArray<StrategyCandidate>
}

interface UseAskPrismChatReturn {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly isLoading: boolean
  readonly error: string | null
  readonly sessionScope: AskPrismSessionScope
  readonly sendMessage: (content: string) => void
  readonly addDivider: (label: string) => void
}

function deriveAskPrismSessionScope(
  page: AskPrismPage,
  signalId?: string,
  entryContext?: AskPrismEntryContext | null,
): AskPrismSessionScope {
  const scopedSignalId = entryContext?.signalId ?? signalId
  if (entryContext?.nodeId && scopedSignalId) {
    return `node:${scopedSignalId}:${entryContext.nodeId}`
  }
  if (scopedSignalId && page === 'plan') {
    return `plan:${scopedSignalId}`
  }
  if (scopedSignalId && (page === 'signal' || page === 'signals_overview')) {
    return `signal:${scopedSignalId}`
  }
  return 'global'
}

export function useAskPrismChat({
  userId,
  page,
  signalId,
  entryContext,
  planSelections,
  planCandidates,
}: UseAskPrismChatOptions): UseAskPrismChatReturn {
  const sessionScope = useMemo(
    () => deriveAskPrismSessionScope(page, signalId, entryContext),
    [entryContext, page, signalId],
  )
  const scopeKey = `${userId}:${sessionScope}`

  const [messages, setMessages] = useState<ReadonlyArray<ChatMessage>>(() => {
    const cached = askPrismCache.get(scopeKey)
    return cached?.messages ?? []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Persist scoped thread to module cache
  useEffect(() => {
    if (messages.length > 0 || askPrismCache.has(scopeKey)) {
      askPrismCache.set(scopeKey, { scopeKey, messages })
    }
  }, [messages, scopeKey])

  // Restore cached thread when scope changes
  useEffect(() => {
    abortRef.current?.abort()
    const cached = askPrismCache.get(scopeKey)
    setMessages(cached?.messages ?? [])
    setError(null)
    setIsLoading(false)
  }, [scopeKey])

  // Cleanup stale caches from other users
  useEffect(() => {
    const userPrefix = `${userId}:`
    for (const key of askPrismCache.keys()) {
      if (!key.startsWith(userPrefix)) {
        askPrismCache.delete(key)
      }
    }
  }, [userId])

  const sendMessage = useCallback(
    (content: string) => {
      if (isLoading) return

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
      abortRef.current = controller

      const history = [...messages, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))

      if (page === 'plan') {
        fetch(`/api/strategy/${userId}/copilot-proposal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signalId,
            message: content,
            sessionScope,
            entryContext,
            currentSelections: planSelections ?? [],
            candidateUniverse: planCandidates ?? [],
            history,
          }),
          signal: controller.signal,
        })
          .then(async (res) => {
            if (!res.ok) {
              const payload = await res.json()
              throw new Error((payload as { error?: string }).error ?? 'Copilot request failed')
            }
            const payload = await res.json() as {
              readonly success: boolean
              readonly data?: AskPrismCopilotProposalResponse
              readonly error?: string
            }
            if (!payload.success || !payload.data) {
              throw new Error(payload.error ?? 'Copilot request failed')
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: payload.data!.assistantText,
                      isStreaming: false,
                      planProposal: payload.data!.proposal ?? undefined,
                      suggestedFollowUps: payload.data!.followUps,
                    }
                  : m,
              ),
            )
            setIsLoading(false)
          })
          .catch((err: Error) => {
            if (err.name === 'AbortError') return
            setError(err.message)
            setIsLoading(false)
            setMessages((prev) => prev.filter((m) => m.id !== assistantId))
          })
        return
      }

      fetch(`/api/chat/${userId}/ask-prism`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          signalId,
          planSelections,
          sessionScope,
          entryContext,
          message: content,
          history,
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
                    m.id === assistantId ? { ...m, content: snapshot, isStreaming: true } : m,
                  ),
                )
              } catch {
                // Skip malformed SSE chunks
              }
            }
          }

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
          setMessages((prev) => prev.filter((m) => m.id !== assistantId))
        })
    },
    [
      entryContext,
      isLoading,
      messages,
      page,
      planCandidates,
      planSelections,
      sessionScope,
      signalId,
      userId,
    ],
  )

  const addDivider = useCallback((label: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId(), role: 'divider' as const, content: label },
    ])
  }, [])

  return { messages, isLoading, error, sessionScope, sendMessage, addDivider }
}

interface UseChatReturn {
  readonly messages: ReadonlyArray<ChatMessage>
  readonly isLoading: boolean
  readonly error: string | null
  readonly sendMessage: (content: string) => void
  readonly addDivider: (label: string) => void
  readonly isInitialized: boolean
}

let messageIdCounter = 0
function nextMessageId(): string {
  messageIdCounter += 1
  return `msg-${messageIdCounter}`
}

// Module-level cache for general chat sessions so they survive route changes
interface GeneralChatCache {
  readonly userId: string
  readonly messages: ReadonlyArray<ChatMessage>
}

let generalChatCache: GeneralChatCache | null = null

export function useChat({
  userId,
  mode = 'contextual',
  node = null,
  chain = null,
  signal = null,
  temporalAnalysis = null,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ReadonlyArray<ChatMessage>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const isGeneral = mode === 'general'

  // Persist general chat messages to module cache on every change
  useEffect(() => {
    if (isGeneral && messages.length > 0) {
      generalChatCache = { userId, messages }
    }
  }, [isGeneral, messages, userId])

  // Clear cache when switching users
  useEffect(() => {
    if (isGeneral && generalChatCache && generalChatCache.userId !== userId) {
      generalChatCache = null
    }
  }, [isGeneral, userId])

  // Reset chat when node changes (contextual) or on mount (general)
  useEffect(() => {
    if (isGeneral) {
      // Restore from cache if available for same user
      if (generalChatCache && generalChatCache.userId === userId) {
        setMessages(generalChatCache.messages)
        setIsLoading(false)
        setError(null)
        return
      }

      // Init general chat
      abortControllerRef.current?.abort()
      setMessages([])
      setError(null)
      setIsLoading(true)
      const controller = new AbortController()
      abortControllerRef.current = controller

      fetch(`/api/chat/${userId}/general/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((payload: { success: boolean; data?: { content: string }; error?: string }) => {
          if (!payload.success || !payload.data) {
            throw new Error(payload.error ?? 'Failed to initialize chat')
          }
          const initMessages: ReadonlyArray<ChatMessage> = [
            { id: nextMessageId(), role: 'assistant', content: payload.data.content },
          ]
          setMessages(initMessages)
          setIsLoading(false)
        })
        .catch((err: Error) => {
          if (err.name === 'AbortError') return
          setError(err.message)
          setIsLoading(false)
        })

      return () => controller.abort()
    }

    // Contextual mode — always reset
    abortControllerRef.current?.abort()
    setMessages([])
    setError(null)
    setIsLoading(false)

    // Contextual mode
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
  }, [isGeneral ? null : node?.id, isGeneral ? null : chain?.id, isGeneral ? null : signal?.id, userId, isGeneral]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    (content: string) => {
      if (isLoading) return
      if (!isGeneral && (!node || !chain || !signal || !temporalAnalysis)) return

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

      const endpoint = isGeneral
        ? `/api/chat/${userId}/general/message`
        : `/api/chat/${userId}/message`

      const body = isGeneral
        ? { history, message: content }
        : { node, chain, signal, temporalAnalysis, history, message: content }

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
    [chain, isGeneral, isLoading, messages, node, signal, temporalAnalysis, userId],
  )

  const addDivider = useCallback((label: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId(), role: 'divider' as const, content: label },
    ])
  }, [])

  const isInitialized = messages.length >= 1 && !isLoading

  return { messages, isLoading, error, sendMessage, addDivider, isInitialized }
}
