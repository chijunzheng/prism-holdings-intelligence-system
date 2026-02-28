// ChatArea — main chat message stream with input.
// Shows a structured welcome screen when no messages, then transitions to chat.
// Wired to /api/v2/analyze for signal analysis and /api/chat/:userId/ask-prism for general chat.

import { useRef, useEffect, useCallback, useState, type MutableRefObject } from 'react'
import { ChatInput } from '../chat/ChatInput'
import { ChatMessage } from '../chat/ChatMessage'
import { ChatCardRenderer } from '../chat-cards/ChatCardRenderer'
import { SuggestedPrompts } from '../chat/SuggestedPrompts'
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat'
import type { FundManagerVerdict, ResearchBrief, Signal } from '@prism/shared'
import type {
  ActionPlaybookData,
  AnalysisCompleteData,
  ChatCard,
  PipelineStageInfo,
  ReasoningTraceData,
  ReasoningTraceStep,
  SignalImpactDeltaData,
} from '../chat-cards/types'
import {
  mapActionPlaybookData,
  mapImpactDeltaData,
  mapReasoningTraceData,
  mapTraceNavigatorData,
} from '../chat-cards/mappers'

interface ChatAreaProps {
  readonly userId: string
  readonly activeSessionId: string | null
  readonly signals?: readonly Signal[]
  readonly onSendRef?: MutableRefObject<((msg: string) => void) | null>
  readonly onAnalyzeSignalRef?: MutableRefObject<((signal: Signal) => void) | null>
  readonly onInsightsUpdate?: (insights: {
    readonly impactDelta?: SignalImpactDeltaData
    readonly playbook?: ActionPlaybookData
    readonly reasoningTrace?: ReasoningTraceData
  }) => void
}

type EnhancedMessage = ChatMessageType & {
  readonly card?: ChatCard
}

const WELCOME_PROMPTS = [
  'What signals are affecting my portfolio?',
  'How diversified am I really?',
  'What happened in markets today?',
  'Show me my risk exposure',
] as const

const CAPABILITIES = [
  {
    icon: '\u26A1',
    title: 'Signal Analysis',
    description: 'Detect and analyze market events affecting your holdings',
    prompt: 'What signals are affecting my portfolio right now?',
  },
  {
    icon: '\uD83D\uDCCA',
    title: 'Portfolio Review',
    description: 'Multi-agent adversarial analysis with real market data',
    prompt: 'Run a full portfolio review with risk analysis',
  },
  {
    icon: '\uD83D\uDCAC',
    title: 'Ask Anything',
    description: 'Plain English answers about your holdings and exposure',
    prompt: 'How does my portfolio handle a recession scenario?',
  },
] as const

// ── Helpers ─────────────────────────────────────────────────

let idCounter = 0
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`
}

/** Project a Signal into the shape the server's AnalyzeRequestSchema expects */
function projectSignalForApi(signal: Signal) {
  return {
    id: signal.id,
    headline: signal.headline,
    description: signal.description,
    affectedExposures: signal.affectedExposures,
    relevanceScore: signal.relevanceScore,
    urgency: signal.urgency,
    sentiment: signal.sentiment,
    temporalClassification: signal.temporalClassification,
    sources: signal.sources.map((s) => ({ title: s.title, url: s.url })),
    detectedAt: signal.detectedAt,
    acknowledged: signal.acknowledged,
  }
}

// ── SSE Parser ──────────────────────────────────────────────

interface SseEvent {
  readonly event: string
  readonly data: unknown
}

/**
 * Parse an SSE stream following the spec:
 * - `event: <name>` sets the event type
 * - `data: <json>` appends to the data buffer (supports multiline via continuation)
 * - Empty line dispatches the accumulated event
 */
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
        // Empty line = end of event
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

  // Flush any remaining data when stream ends
  if (currentData) {
    try {
      const data = JSON.parse(currentData) as unknown
      yield { event: currentEvent || 'message', data }
    } catch {
      // Skip
    }
  }
}

// ── Pipeline Progress Stage Definitions ──────────────────────

const PIPELINE_STAGES: readonly { id: string; label: string }[] = [
  { id: 'risk_profile', label: 'Inferring risk profile' },
  { id: 'market_data', label: 'Fetching market data' },
  { id: 'analyst_complete', label: 'Running analyst team (4 agents)' },
  { id: 'debate_complete', label: 'Bull vs Bear debate' },
  { id: 'risk_challenge', label: 'Challenging assumptions' },
  { id: 'magnitude_validation', label: 'Validating magnitudes' },
  { id: 'stress_complete', label: 'Monte Carlo stress test' },
  { id: 'verdict', label: 'Fund manager synthesis' },
  { id: 'judge', label: 'Quality evaluation' },
  { id: 'brief', label: 'Generating research brief' },
]

function buildInitialStages(): PipelineStageInfo[] {
  return PIPELINE_STAGES.map((s, i) => ({
    ...s,
    status: i === 0 ? 'active' : 'pending',
  }))
}

function advanceStages(
  stages: readonly PipelineStageInfo[],
  completedStageId: string,
  message?: string,
): PipelineStageInfo[] {
  const completedIdx = stages.findIndex((s) => s.id === completedStageId)
  if (completedIdx === -1) return [...stages]

  return stages.map((s, i) => {
    if (i < completedIdx) {
      // Only mark prior stages complete if they were already active/complete — don't assume
      return s.status === 'pending' ? { ...s, status: 'complete' as const } : s
    }
    if (i === completedIdx) return { ...s, status: 'complete' as const, message }
    if (i === completedIdx + 1) return { ...s, status: 'active' as const }
    return s
  })
}

function markAllComplete(stages: readonly PipelineStageInfo[]): PipelineStageInfo[] {
  return stages.map((s) => ({ ...s, status: 'complete' as const }))
}

function upsertCardMessage(
  messages: readonly EnhancedMessage[],
  id: string,
  card: ChatCard,
): EnhancedMessage[] {
  const next = [...messages]
  const idx = next.findIndex((msg) => msg.id === id)
  const message: EnhancedMessage = { id, role: 'assistant', content: '', card }
  if (idx === -1) {
    next.push(message)
    return next
  }
  next[idx] = message
  return next
}

// ── Component ───────────────────────────────────────────────

export function ChatArea({
  userId,
  activeSessionId,
  signals,
  onSendRef,
  onAnalyzeSignalRef,
  onInsightsUpdate,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<readonly EnhancedMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset messages when session changes; abort in-flight requests
  useEffect(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setMessages([])
    setIsLoading(false)
  }, [activeSessionId, userId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const showWelcome = messages.length === 0

  // ── Signal Analysis Flow (multi-agent pipeline) ─────────

  const analyzeSignal = useCallback(
    async (signal: Signal) => {
      if (isLoading) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      let latestImpactDelta: SignalImpactDeltaData | undefined
      let latestPlaybook: ActionPlaybookData | undefined
      let latestReasoningTrace: ReasoningTraceData | undefined
      let reasoningSteps: ReasoningTraceStep[] = []

      const userMsg: EnhancedMessage = {
        id: uid('msg'),
        role: 'user',
        content: `Analyze: ${signal.headline}`,
      }

      const signalMsg: EnhancedMessage = {
        id: uid('card-signal'),
        role: 'assistant',
        content: '',
        card: { type: 'signal', data: signal },
      }

      const progressId = uid('card-progress')
      const impactDeltaId = uid('card-impact-delta')
      const actionPlaybookId = uid('card-playbook')
      const traceNavigatorId = uid('card-trace-nav')
      const reasoningTraceId = uid('card-reasoning-trace')
      const recommendationId = uid('card-rec')
      const researchBriefId = uid('card-brief')
      const initialStages = buildInitialStages()
      const progressMsg: EnhancedMessage = {
        id: progressId,
        role: 'assistant',
        content: '',
        card: { type: 'pipeline_progress', data: { stages: initialStages } },
      }

      setMessages((prev) => [...prev, userMsg, signalMsg, progressMsg])
      setIsLoading(true)

      try {
        const res = await fetch('/api/v2/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            userId,
            signal: projectSignalForApi(signal),
            skipCheckpoints: true,
          }),
        })

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
          throw new Error(errorBody.error ?? `Analysis request failed: ${res.status}`)
        }

        const contentType = res.headers.get('content-type') ?? ''

        if (contentType.includes('text/event-stream')) {
          const reader = res.body?.getReader()
          if (!reader) throw new Error('No response stream')

          // Track stages for progressive updates
          let currentStages = initialStages

          for await (const sseEvent of parseSseStream(reader)) {
            if (controller.signal.aborted) break

            if (sseEvent.event === 'impact_delta') {
              const impactData = sseEvent.data as SignalImpactDeltaData
              latestImpactDelta = impactData

              setMessages((prev) =>
                upsertCardMessage(prev, impactDeltaId, {
                  type: 'signal_impact_delta',
                  data: impactData,
                }),
              )

              onInsightsUpdate?.({
                impactDelta: latestImpactDelta,
                playbook: latestPlaybook,
                reasoningTrace: latestReasoningTrace,
              })
            } else if (sseEvent.event === 'playbook') {
              const playbookData = sseEvent.data as ActionPlaybookData
              latestPlaybook = playbookData

              setMessages((prev) =>
                upsertCardMessage(prev, actionPlaybookId, {
                  type: 'action_playbook',
                  data: playbookData,
                }),
              )

              onInsightsUpdate?.({
                impactDelta: latestImpactDelta,
                playbook: latestPlaybook,
                reasoningTrace: latestReasoningTrace,
              })
            } else if (sseEvent.event === 'trace_step') {
              const step = sseEvent.data as ReasoningTraceStep
              reasoningSteps = [...reasoningSteps, step]

              setMessages((prev) => {
                let next = upsertCardMessage(prev, traceNavigatorId, {
                  type: 'trace_navigator',
                  data: mapTraceNavigatorData({
                    signal,
                    steps: reasoningSteps,
                    totalSteps: PIPELINE_STAGES.length,
                  }),
                })

                const traceData = mapReasoningTraceData({
                  signal,
                  verdict: {
                    signalId: signal.id,
                    holdingImpacts: [],
                    recommendations: [],
                    riskAdjustments: {
                      confidenceHaircut: 0,
                      magnitudeBoundsApplied: [],
                      scenarioPreference: 'base',
                    },
                    perspectiveBreakdown: {
                      bullCase: '',
                      bearCase: '',
                      unresolvedDisagreements: [],
                    },
                    qualityScore: 0,
                    humanDecisionRequired: true,
                  },
                  steps: reasoningSteps,
                })
                latestReasoningTrace = traceData
                next = upsertCardMessage(next, reasoningTraceId, {
                  type: 'reasoning_trace',
                  data: traceData,
                })

                return next
              })

              onInsightsUpdate?.({
                impactDelta: latestImpactDelta,
                playbook: latestPlaybook,
                reasoningTrace: latestReasoningTrace,
              })
            } else if (sseEvent.event === 'complete') {
              // Pipeline finished — mark all stages complete, add result cards
              const finalStages = markAllComplete(currentStages)
              const payload = sseEvent.data as AnalysisCompleteData

              setMessages((prev) => {
                let next = prev.map((m) =>
                  m.id === progressId
                    ? { ...m, card: { type: 'pipeline_progress', data: { stages: finalStages } } as ChatCard }
                    : m,
                )

                if (payload.verdict) {
                  const verdict = payload.verdict as FundManagerVerdict
                  const impactDelta = latestImpactDelta ?? mapImpactDeltaData(signal, verdict)
                  const playbook = latestPlaybook ?? mapActionPlaybookData(signal, verdict)
                  const reasoningTrace = mapReasoningTraceData({
                    signal,
                    verdict,
                    researchBrief: payload.researchBrief as ResearchBrief | undefined,
                    intermediateArtifacts: payload.intermediateArtifacts,
                    steps: reasoningSteps,
                  })

                  latestImpactDelta = impactDelta
                  latestReasoningTrace = reasoningTrace
                  if (playbook) latestPlaybook = playbook

                  next = upsertCardMessage(next, impactDeltaId, {
                    type: 'signal_impact_delta',
                    data: impactDelta,
                  })

                  if (playbook) {
                    next = upsertCardMessage(next, actionPlaybookId, {
                      type: 'action_playbook',
                      data: playbook,
                    })
                  }

                  next = upsertCardMessage(next, traceNavigatorId, {
                    type: 'trace_navigator',
                    data: mapTraceNavigatorData({
                      signal,
                      steps: reasoningSteps,
                      totalSteps: PIPELINE_STAGES.length,
                    }),
                  })

                  next = upsertCardMessage(next, reasoningTraceId, {
                    type: 'reasoning_trace',
                    data: reasoningTrace,
                  })

                  if (verdict.recommendations.length > 0) {
                    next = upsertCardMessage(next, recommendationId, {
                      type: 'recommendation',
                      data: verdict.recommendations,
                    })
                  }
                }

                if (payload.researchBrief) {
                  next = upsertCardMessage(next, researchBriefId, {
                    type: 'research_brief',
                    data: payload.researchBrief as ResearchBrief,
                  })
                }

                return next
              })

              onInsightsUpdate?.({
                impactDelta: latestImpactDelta,
                playbook: latestPlaybook,
                reasoningTrace: latestReasoningTrace,
              })
            } else if (sseEvent.event === 'error') {
              const errorData = sseEvent.data as { message?: string }
              // Keep progress card with error state — no duplicate error message
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === progressId
                    ? { ...m, card: { type: 'pipeline_progress', data: { stages: currentStages, error: errorData.message ?? 'Pipeline failed' } } }
                    : m,
                ),
              )
            } else {
              // Progress event — advance the pipeline progress card
              const eventData = sseEvent.data as { stage?: string; message?: string }
              const stageId = eventData.stage ?? sseEvent.event
              const nextStages = advanceStages(currentStages, stageId, eventData.message)
              currentStages = nextStages

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === progressId
                    ? { ...m, card: { type: 'pipeline_progress', data: { stages: nextStages } } }
                    : m,
                ),
              )
            }
          }
        } else {
          // Cached JSON response
          const json = await res.json() as {
            success: boolean
            cached?: boolean
            data?: AnalysisCompleteData
          }

          setMessages((prev) => {
            let next = prev.map((m) =>
              m.id === progressId
                ? { ...m, card: { type: 'pipeline_progress', data: { stages: markAllComplete(initialStages) } } }
                : m)

            if (json.cached) {
              next = [
                ...next,
                {
                  id: uid('msg-cached'),
                  role: 'assistant',
                  content: 'Retrieved cached analysis results.',
                },
              ]
            }

            if (json.success && json.data?.verdict) {
              const verdict = json.data.verdict
              const impactDelta = mapImpactDeltaData(signal, verdict)
              const playbook = mapActionPlaybookData(signal, verdict)
              const reasoningTrace = mapReasoningTraceData({
                signal,
                verdict,
                researchBrief: json.data.researchBrief,
                intermediateArtifacts: json.data.intermediateArtifacts,
                steps: reasoningSteps,
              })

              latestImpactDelta = impactDelta
              latestReasoningTrace = reasoningTrace
              if (playbook) latestPlaybook = playbook

              next = upsertCardMessage(next, impactDeltaId, {
                type: 'signal_impact_delta',
                data: impactDelta,
              })

              if (playbook) {
                next = upsertCardMessage(next, actionPlaybookId, {
                  type: 'action_playbook',
                  data: playbook,
                })
              }

              next = upsertCardMessage(next, reasoningTraceId, {
                type: 'reasoning_trace',
                data: reasoningTrace,
              })

              next = upsertCardMessage(next, recommendationId, {
                type: 'recommendation',
                data: verdict.recommendations,
              })
            }

            if (json.success && json.data?.researchBrief) {
              next = upsertCardMessage(next, researchBriefId, {
                type: 'research_brief',
                data: json.data.researchBrief,
              })
            }

            return next
          })

          onInsightsUpdate?.({
            impactDelta: latestImpactDelta,
            playbook: latestPlaybook,
            reasoningTrace: latestReasoningTrace,
          })
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== progressId),
          {
            id: uid('msg-error'),
            role: 'assistant',
            content: `Sorry, analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ])
      }

      setIsLoading(false)
    },
    [isLoading, onInsightsUpdate, userId],
  )

  // ── Portfolio Review Flow ───────────────────────────────

  const runPortfolioReview = useCallback(
    async (signalsToReview: readonly Signal[]) => {
      if (isLoading || signalsToReview.length === 0) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const userMsg: EnhancedMessage = {
        id: uid('msg'),
        role: 'user',
        content: `Run portfolio review across ${signalsToReview.length} active signals`,
      }

      const progressId = uid('card-progress')
      const initialStages = buildInitialStages()
      const progressMsg: EnhancedMessage = {
        id: progressId,
        role: 'assistant',
        content: '',
        card: { type: 'pipeline_progress', data: { stages: initialStages } },
      }

      setMessages((prev) => [...prev, userMsg, progressMsg])
      setIsLoading(true)

      try {
        const res = await fetch('/api/v2/analyze/portfolio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            userId,
            signals: signalsToReview.map(projectSignalForApi),
          }),
        })

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
          throw new Error(errorBody.error ?? `Portfolio review failed: ${res.status}`)
        }

        const contentType = res.headers.get('content-type') ?? ''

        if (contentType.includes('text/event-stream')) {
          const reader = res.body?.getReader()
          if (!reader) throw new Error('No response stream')

          let currentStages = initialStages

          for await (const sseEvent of parseSseStream(reader)) {
            if (controller.signal.aborted) break

            if (sseEvent.event === 'complete') {
              const finalStages = markAllComplete(currentStages)
              setMessages((prev) => [
                ...prev.map((m) =>
                  m.id === progressId
                    ? { ...m, card: { type: 'pipeline_progress', data: { stages: finalStages } } }
                    : m,
                ),
                {
                  id: uid('card-portfolio'),
                  role: 'assistant',
                  content: '',
                  card: { type: 'portfolio_review', data: sseEvent.data },
                },
              ])
            } else if (sseEvent.event === 'error') {
              const errorData = sseEvent.data as { message?: string }
              setMessages((prev) => [
                ...prev.map((m) =>
                  m.id === progressId
                    ? { ...m, card: { type: 'pipeline_progress', data: { stages: currentStages, error: errorData.message } } }
                    : m,
                ),
              ])
            } else {
              const eventData = sseEvent.data as { stage?: string; message?: string }
              const stageId = eventData.stage ?? sseEvent.event
              const nextStages = advanceStages(currentStages, stageId, eventData.message)
              currentStages = nextStages

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === progressId
                    ? { ...m, card: { type: 'pipeline_progress', data: { stages: nextStages } } }
                    : m,
                ),
              )
            }
          }
        } else {
          const json = await res.json() as { success: boolean; data?: unknown }
          const resultCards: EnhancedMessage[] = []
          if (json.success && json.data) {
            resultCards.push({
              id: uid('card-portfolio'),
              role: 'assistant',
              content: '',
              card: { type: 'portfolio_review', data: json.data },
            })
          }
          setMessages((prev) => [
            ...prev.map((m) =>
              m.id === progressId
                ? { ...m, card: { type: 'pipeline_progress', data: { stages: markAllComplete(initialStages) } } }
                : m,
            ),
            ...resultCards,
          ])
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== progressId),
          {
            id: uid('msg-error'),
            role: 'assistant',
            content: `Portfolio review failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ])
      }

      setIsLoading(false)
    },
    [isLoading, userId],
  )

  // ── General Chat Flow (ask-prism fallback) ──────────────

  const handleGeneralChat = useCallback(
    async (content: string) => {
      if (isLoading) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const userMsg: EnhancedMessage = {
        id: uid('msg'),
        role: 'user',
        content,
      }

      const thinkingId = uid('card-thinking')
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: thinkingId,
          role: 'assistant',
          content: '',
          card: { type: 'thinking', data: { stage: 'thinking', message: 'Prism is thinking...' } },
        },
      ])
      setIsLoading(true)

      try {
        const res = await fetch(`/api/chat/${userId}/ask-prism`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            page: 'portfolio',
            message: content,
            history: messages
              .filter((m) => m.role !== 'divider' && !m.card)
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        })

        if (!res.ok) throw new Error('Chat request failed')

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response stream')

        const assistantId = uid('msg-assistant')
        // Replace the thinking card with the streaming message
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== thinkingId),
          { id: assistantId, role: 'assistant', content: '', isStreaming: true },
        ])

        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const text = decoder.decode(value, { stream: true })
          for (const line of text.split('\n')) {
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
              // Skip malformed chunks
            }
          }
        }

        // Finalize streaming message and append signal cards if query was signal-related
        const isSignalQuery = /signal|affecting|portfolio|market|impact|risk/i.test(content)
        const signalCards: EnhancedMessage[] = (isSignalQuery && signals && signals.length > 0)
          ? signals.map((s) => ({
              id: uid('card-signal-inline'),
              role: 'assistant' as const,
              content: '',
              card: { type: 'signal', data: s },
            }))
          : []

        setMessages((prev) => [
          ...prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m,
          ),
          ...signalCards,
        ])
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== thinkingId),
          {
            id: uid('msg-error'),
            role: 'assistant',
            content: `Sorry, something went wrong: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ])
      }

      setIsLoading(false)
    },
    [isLoading, messages, userId, signals],
  )

  // ── Router: decide which flow to use based on input ─────

  const handleSend = useCallback(
    async (content: string) => {
      const lower = content.toLowerCase()

      // Detect portfolio review intent
      if (
        lower.includes('portfolio review') ||
        lower.includes('full portfolio') ||
        lower.includes('review all signals')
      ) {
        if (signals && signals.length > 0) {
          await runPortfolioReview(signals)
          return
        }
      }

      // Detect signal analysis intent — check if user referenced a specific signal
      if (signals && signals.length > 0) {
        const matchedSignal = signals.find(
          (s) =>
            lower.includes(s.headline.toLowerCase()) ||
            lower.includes(s.id.toLowerCase()),
        )
        if (matchedSignal) {
          await analyzeSignal(matchedSignal)
          return
        }
      }

      // Default: general chat
      await handleGeneralChat(content)
    },
    [signals, analyzeSignal, runPortfolioReview, handleGeneralChat],
  )

  // Expose handleSend and analyzeSignal to parent via refs
  useEffect(() => {
    if (onSendRef) {
      onSendRef.current = handleSend
    }
    return () => {
      if (onSendRef) {
        onSendRef.current = null
      }
    }
  }, [onSendRef, handleSend])

  useEffect(() => {
    if (onAnalyzeSignalRef) {
      onAnalyzeSignalRef.current = analyzeSignal
    }
    return () => {
      if (onAnalyzeSignalRef) {
        onAnalyzeSignalRef.current = null
      }
    }
  }, [onAnalyzeSignalRef, analyzeSignal])

  // ── Signal card "Analyze Impact" handler ────────────────

  const handleAnalyzeSignal = useCallback(
    (signalId: string) => {
      const signal = signals?.find((s) => s.id === signalId)
      if (signal) {
        void analyzeSignal(signal)
      }
    },
    [signals, analyzeSignal],
  )

  const handleCheckpointSubmit = useCallback((_value: string) => {
    // TODO: Wire to /api/v2/analyze/:threadId/resume when checkpoints are enabled
  }, [])

  return (
    <div className="chat-area">
      {showWelcome ? (
        <div className="chat-area__welcome">
          <h1 className="chat-area__welcome-heading">Prism</h1>
          <p className="chat-area__welcome-subtitle">
            Your portfolio intelligence assistant. Understand how market events affect your holdings with multi-agent analysis grounded in real data.
          </p>

          <div className="chat-area__welcome-capabilities">
            {CAPABILITIES.map((cap) => (
              <button
                key={cap.title}
                type="button"
                className="chat-area__capability-card"
                onClick={() => handleSend(cap.prompt)}
              >
                <span className="chat-area__capability-icon">{cap.icon}</span>
                <span className="chat-area__capability-title">{cap.title}</span>
                <span className="chat-area__capability-desc">{cap.description}</span>
              </button>
            ))}
          </div>
          <div className="chat-area__welcome-prompts">
            <SuggestedPrompts
              onSelect={handleSend}
              prompts={WELCOME_PROMPTS}
            />
          </div>
        </div>
      ) : (
        <div className="chat-area__messages">
          {messages.map((msg) => {
            if (msg.card) {
              return (
                <div key={msg.id} className="chat-area__card-wrapper">
                  <ChatCardRenderer
                    card={msg.card}
                    onCheckpointSubmit={handleCheckpointSubmit}
                    onSignalAnalyze={handleAnalyzeSignal}
                  />
                </div>
              )
            }
            return <ChatMessage key={msg.id} message={msg} onFollowUp={handleSend} />
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
      <div className="chat-area__input">
        <ChatInput onSend={handleSend} disabled={isLoading} />
        <p className="chat-area__disclaimer">
          Prism provides analysis, not financial advice. Always verify before acting.
        </p>
      </div>
    </div>
  )
}
