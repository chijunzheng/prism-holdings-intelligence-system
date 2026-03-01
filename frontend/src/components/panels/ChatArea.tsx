// ChatArea — main chat message stream with input.
// Shows a structured welcome screen when no messages, then transitions to chat.
// Unified: all messages flow through POST /api/v2/chat (router agent decides pipeline vs chat).

import { useRef, useEffect, useCallback, useState, type MutableRefObject, type WheelEvent } from 'react'
import { ChatInput } from '../chat/ChatInput'
import { ChatMessage } from '../chat/ChatMessage'
import { ChatCardRenderer } from '../chat-cards/ChatCardRenderer'
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat'
import type { Signal } from '@prism/shared'
import { useUnifiedChat, type ChatChunkData } from '../../hooks/useUnifiedChat'
import type {
  ActionCenterMode,
  AnalysisCompleteData,
  ChatCard,
  PipelineStageInfo,
  ReasoningTraceData,
  ReasoningTraceStep,
  SignalImpactDeltaData,
  TransparencyBarData,
  VerdictSummaryData,
} from '../chat-cards/types'
import {
  mapImpactDeltaData,
  mapReasoningTraceData,
} from '../chat-cards/mappers'
import { selectPipelineCards } from '../chat-cards/card-selection'
import {
  buildPortfolioReviewFollowUps,
  buildSignalAnalysisFollowUps,
} from './follow-up-builder'

interface ChatAreaProps {
  readonly userId: string
  readonly activeSessionId: string | null
  readonly signals?: readonly Signal[]
  readonly userName?: string
  readonly onSendRef?: MutableRefObject<((msg: string) => void) | null>
  readonly onAnalyzeSignalRef?: MutableRefObject<((signal: Signal) => void) | null>
  readonly onCreateSession?: (params: {
    type: 'signal' | 'portfolio_review' | 'holding' | 'general'
    title: string
    signalId?: string
  }) => Promise<string>
  readonly onUpdateSession?: (sessionId: string, params: {
    title?: string
  }) => void
  readonly onSavePlan?: (recommendationId: string, recommendations: readonly import('@prism/shared').Recommendation[]) => void
  readonly onActionCenterMode?: (mode: ActionCenterMode) => void
}

type EnhancedMessage = ChatMessageType & {
  readonly card?: ChatCard
}

// Thin-line SVG icons (Wealthsimple style: 1.5px stroke, no fill)
const PillIcons = {
  signal: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  portfolio: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  chat: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  summary: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  optimize: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
  shield: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
} as const

const CATEGORY_PILLS = [
  { label: 'Impact Analysis', icon: PillIcons.signal, prompt: 'What signals are affecting my portfolio right now?' },
  { label: 'Portfolio Review', icon: PillIcons.portfolio, prompt: 'Run a full portfolio review with risk analysis' },
  { label: 'Improve My Portfolio', icon: PillIcons.optimize, prompt: 'How can I improve my portfolio given current market conditions?' },
  { label: 'Explore a Stock', icon: PillIcons.search, prompt: "I'd like to explore adding a new stock or ETF to my portfolio. Help me find a good fit." },
  { label: 'Risk Check', icon: PillIcons.shield, prompt: 'What are the biggest risks in my portfolio right now?' },
] as const

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

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
      return s.status === 'pending' ? { ...s, status: 'complete' as const, thinkingText: undefined } : s
    }
    if (i === completedIdx) return { ...s, status: 'complete' as const, message, thinkingText: undefined }
    if (i === completedIdx + 1) return { ...s, status: 'active' as const }
    return s
  })
}

function markAllComplete(stages: readonly PipelineStageInfo[]): PipelineStageInfo[] {
  return stages.map((s) => ({ ...s, status: 'complete' as const, thinkingText: undefined }))
}

// Pause progress at a checkpoint: mark the next pending stage as 'waiting'
function pauseAtCheckpoint(stages: readonly PipelineStageInfo[]): PipelineStageInfo[] {
  const activeIdx = stages.findIndex((s) => s.status === 'active')
  if (activeIdx === -1) return [...stages]
  return stages.map((s, i) =>
    i === activeIdx ? { ...s, status: 'waiting' as const, thinkingText: undefined } : s,
  )
}

// Resume progress from checkpoint: set the first 'waiting' stage back to 'active'
function resumeFromCheckpoint(stages: readonly PipelineStageInfo[]): PipelineStageInfo[] {
  const waitingIdx = stages.findIndex((s) => s.status === 'waiting')
  if (waitingIdx === -1) return [...stages]
  return stages.map((s, i) =>
    i === waitingIdx ? { ...s, status: 'active' as const } : s,
  )
}

function updateThinkingText(
  stages: readonly PipelineStageInfo[],
  stageId: string | undefined,
  text: string,
): PipelineStageInfo[] {
  // Find the target stage by id, or fall back to the currently active stage
  const targetIdx = stageId
    ? stages.findIndex((s) => s.id === stageId)
    : stages.findIndex((s) => s.status === 'active')
  if (targetIdx === -1) return [...stages]

  return stages.map((s, i) =>
    i === targetIdx ? { ...s, thinkingText: text } : s,
  )
}

function buildPipelineProgressCard(
  stages: readonly PipelineStageInfo[],
  error?: string,
): ChatCard {
  return {
    type: 'pipeline_progress',
    data: {
      stages,
      ...(error ? { error } : {}),
    },
  }
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
  userName,
  onSendRef,
  onAnalyzeSignalRef,
  onCreateSession,
  onUpdateSession,
  onSavePlan,
  onActionCenterMode,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<readonly EnhancedMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const shouldAutoScrollRef = useRef(true)
  const isSendingRef = useRef(false) // Guards against session-change wipe during active send
  const threadIdRef = useRef<string | null>(null)
  const currentStagesRef = useRef<PipelineStageInfo[]>([])
  const progressIdRef = useRef<string>('')
  const activeSignalRef = useRef<Signal | null>(null)
  const { sendMessage: sendUnifiedMessage, abort: abortUnified } = useUnifiedChat(userId)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'auto' })
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [messages])

  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    shouldAutoScrollRef.current = distanceFromBottom < 72
  }, [])

  const handleMessagesWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (event.deltaY < 0) {
      shouldAutoScrollRef.current = false
    }
  }, [])

  // Reset messages when session changes; abort in-flight requests
  // Skip reset if we just created a session as part of an active send
  useEffect(() => {
    if (isSendingRef.current) return
    abortRef.current?.abort()
    abortRef.current = null
    abortUnified()
    setMessages([])
    setIsLoading(false)
    shouldAutoScrollRef.current = true
  }, [activeSessionId, userId, abortUnified])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      abortUnified()
    }
  }, [abortUnified])

  const showWelcome = messages.length === 0

  // ── Signal Analysis Flow (multi-agent pipeline) ─────────

  const analyzeSignal = useCallback(
    async (signal: Signal) => {
      if (isLoading) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      let latestImpactDelta: SignalImpactDeltaData | undefined
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
      const verdictSummaryId = uid('card-verdict-summary')
      const impactDeltaId = uid('card-impact-delta')
      const debateSummaryId = uid('card-debate-summary')
      const traceNavigatorId = uid('card-trace-nav')
      const reasoningTraceId = uid('card-reasoning-trace')
      const recommendationId = uid('card-rec')
      const researchBriefId = uid('card-brief')
      const transparencyBarId = uid('card-transparency-bar')
      const initialStages = buildInitialStages()
      const progressMsg: EnhancedMessage = {
        id: progressId,
        role: 'assistant',
        content: '',
        card: buildPipelineProgressCard(initialStages),
      }

      setMessages((prev) => [...prev, userMsg, signalMsg, progressMsg])
      setIsLoading(true)
      shouldAutoScrollRef.current = true

      // Store signal ref for resume flow
      activeSignalRef.current = signal

      try {
        const res = await fetch('/api/v2/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            userId,
            signal: projectSignalForApi(signal),
            pipelineMode: 'guided',
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
          currentStagesRef.current = currentStages
          progressIdRef.current = progressId

          for await (const sseEvent of parseSseStream(reader)) {
            if (controller.signal.aborted) break

            if (sseEvent.event === 'thread_id') {
              const { threadId } = sseEvent.data as { threadId: string }
              threadIdRef.current = threadId

            } else if (sseEvent.event === 'checkpoint') {
              const cpData = sseEvent.data as {
                stage: string
                type: 'hard' | 'soft'
                debateResolution?: unknown
                stressTest?: unknown
                analystAssessments?: unknown
                riskProfile?: unknown
                riskChallenge?: unknown
              }

              // Pause pipeline progress at checkpoint
              currentStages = pauseAtCheckpoint(currentStages)
              currentStagesRef.current = currentStages

              setMessages((prev) => {
                let next = prev.map((m) =>
                  m.id === progressId
                    ? { ...m, card: buildPipelineProgressCard(currentStages) }
                    : m,
                )

                if (cpData.stage === 'debate_resolution') {
                  next = [
                    ...next,
                    {
                      id: uid('bridge'),
                      role: 'assistant' as const,
                      content: "My analysts debated this. Here's where they landed \u2014 review and let me know if you'd adjust anything.",
                    },
                    {
                      id: uid('card-debate'),
                      role: 'assistant' as const,
                      content: '',
                      card: { type: 'debate_summary' as const, data: cpData.debateResolution },
                    },
                    {
                      id: uid('card-cp'),
                      role: 'assistant' as const,
                      content: '',
                      card: {
                        type: 'checkpoint' as const,
                        data: {
                          stage: 'debate_resolution',
                          prompt: 'Approve the debate outcome or provide a correction.',
                          quickReplies: [
                            'Looks good, continue',
                            'I disagree with the magnitude',
                            'The timing assumption is wrong',
                          ],
                        },
                      },
                    },
                  ]
                } else if (cpData.stage === 'stress_test') {
                  next = [
                    ...next,
                    {
                      id: uid('bridge'),
                      role: 'assistant' as const,
                      content: 'Here are the stress test scenarios. Which risk level do you want to plan for?',
                    },
                    {
                      id: uid('card-stress'),
                      role: 'assistant' as const,
                      content: '',
                      card: { type: 'stress_scenario' as const, data: cpData.stressTest },
                    },
                  ]
                } else if (cpData.type === 'soft') {
                  const softData: import('../chat-cards/types').SoftCheckpointData = {
                    stage: cpData.stage,
                    type: 'soft',
                    prompt: `Review ${cpData.stage.replace(/_/g, ' ')} before continuing.`,
                  }
                  next = [
                    ...next,
                    {
                      id: uid('card-soft-cp'),
                      role: 'assistant' as const,
                      content: '',
                      card: {
                        type: 'soft_checkpoint' as const,
                        data: softData,
                      },
                    },
                  ]
                }

                return next
              })

              setIsLoading(false)
              // Stream will end here (server closes SSE on checkpoint)
              // Resume happens via handleCheckpointSubmit

            } else if (sseEvent.event === 'impact_delta') {
              const impactData = sseEvent.data as SignalImpactDeltaData
              latestImpactDelta = impactData

              setMessages((prev) =>
                upsertCardMessage(prev, impactDeltaId, {
                  type: 'signal_impact_delta',
                  data: impactData,
                }),
              )

              // Data flows through card interactions to Action Center
            } else if (sseEvent.event === 'playbook') {
              // Playbook data absorbed into RecommendationCard — no standalone card
            } else if (sseEvent.event === 'trace_step') {
              // Store reasoning steps (shown in Action Center via TransparencyBar, not in stream)
              const step = sseEvent.data as ReasoningTraceStep
              reasoningSteps = [...reasoningSteps, step]
            } else if (sseEvent.event === 'complete') {
              // Pipeline finished — use card selection to build dynamic card sequence
              const finalStages = markAllComplete(currentStages)
              const payload = sseEvent.data as AnalysisCompleteData
              const selection = selectPipelineCards(payload)

              setMessages((prev) => {
                let next = prev.map((m) =>
                  m.id === progressId
                    ? { ...m, card: buildPipelineProgressCard(finalStages) }
                    : m,
                )

                // Remove streaming trace cards (they're now in Action Center only)
                next = next.filter((m) =>
                  m.id !== traceNavigatorId && m.id !== reasoningTraceId,
                )

                if (payload.verdict) {
                  const verdict = payload.verdict
                  const impactDelta =
                    latestImpactDelta ??
                    payload.impactDelta ??
                    mapImpactDeltaData(signal, verdict)
                  const reasoningTrace = mapReasoningTraceData({
                    signal,
                    verdict,
                    researchBrief: payload.researchBrief,
                    intermediateArtifacts: payload.intermediateArtifacts,
                    steps: reasoningSteps,
                  })

                  latestImpactDelta = impactDelta
                  latestReasoningTrace = reasoningTrace

                  // Verdict summary (TL;DR) — appears first
                  if (selection.showVerdictSummary) {
                    const netImpact = verdict.holdingImpacts
                      .map((h) => h.impact['1M']?.mid ?? 0)
                      .reduce((sum, v) => sum + v, 0)
                    const holdingCount = verdict.holdingImpacts.length
                    const avgConfidence = holdingCount > 0
                      ? verdict.holdingImpacts.reduce((sum, h) => sum + h.confidence, 0) / holdingCount
                      : 0
                    const direction: VerdictSummaryData['direction'] =
                      netImpact < -25 ? 'bearish' : netImpact > 25 ? 'bullish' : 'neutral'

                    next = upsertCardMessage(next, verdictSummaryId, {
                      type: 'verdict_summary',
                      data: {
                        netImpact,
                        holdingCount,
                        direction,
                        confidence: Math.round(avgConfidence * 100),
                        signalHeadline: signal.headline,
                      },
                    })
                  }

                  // Impact delta
                  if (selection.showImpactDelta) {
                    next = upsertCardMessage(next, impactDeltaId, {
                      type: 'signal_impact_delta',
                      data: impactDelta,
                    })
                  }

                  // Debate summary (promoted above recs if unresolved disagreements)
                  if (selection.showDebate && payload.intermediateArtifacts?.debateResolution) {
                    next = upsertCardMessage(next, debateSummaryId, {
                      type: 'debate_summary',
                      data: payload.intermediateArtifacts.debateResolution,
                    })
                  }

                  // Recommendations (no separate playbook card — absorbed into rec card)
                  if (selection.showRecommendations) {
                    next = upsertCardMessage(next, recommendationId, {
                      type: 'recommendation',
                      data: verdict.recommendations,
                    })
                  }
                }

                // Research brief as compact chip (never inline)
                if (payload.researchBrief) {
                  next = upsertCardMessage(next, researchBriefId, {
                    type: 'research_brief',
                    data: payload.researchBrief,
                  })
                }

                // Transparency bar (replaces reasoning trace in stream)
                if (selection.showTransparencyBar && latestReasoningTrace) {
                  const debateRounds = payload.intermediateArtifacts?.debateResolution?.rounds ?? 0
                  const qualityScore = payload.verdict?.qualityScore ?? 0
                  const agentCount = PIPELINE_STAGES.length

                  const transparencyData: TransparencyBarData = {
                    agentCount,
                    debateRounds,
                    qualityScore,
                    reasoningTrace: latestReasoningTrace,
                  }

                  next = upsertCardMessage(next, transparencyBarId, {
                    type: 'transparency_bar',
                    data: transparencyData,
                  })
                }

                // Attach contextual follow-ups to the last card
                if (payload.verdict) {
                  const followUps = buildSignalAnalysisFollowUps(signal, payload.verdict)
                  const lastIdx = next.length - 1
                  if (lastIdx >= 0 && next[lastIdx].card) {
                    next = [...next.slice(0, lastIdx), { ...next[lastIdx], suggestedFollowUps: [...followUps] }]
                  }
                }

                return next
              })

              // Data flows through card interactions to Action Center
            } else if (sseEvent.event === 'error') {
              const errorData = sseEvent.data as { message?: string }
              // Keep progress card with error state — no duplicate error message
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === progressId
                    ? { ...m, card: buildPipelineProgressCard(currentStages, errorData.message ?? 'Pipeline failed') }
                    : m,
                ),
              )
            } else if (sseEvent.event === 'agent_thinking') {
              // Real-time thinking text — update the active stage's thinkingText
              const thinkingData = sseEvent.data as { stage?: string; text?: string }
              if (thinkingData.text) {
                currentStages = updateThinkingText(currentStages, thinkingData.stage, thinkingData.text)
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === progressId
                      ? { ...m, card: buildPipelineProgressCard(currentStages) }
                      : m,
                  ),
                )
              }
            } else {
              // Progress event — advance the pipeline progress card
              const eventData = sseEvent.data as { stage?: string; message?: string }
              const stageId = eventData.stage ?? sseEvent.event
              const nextStages = advanceStages(currentStages, stageId, eventData.message)
              currentStages = nextStages

              setMessages((prev) =>
                prev.map((m) =>
                  m.id === progressId
                    ? { ...m, card: buildPipelineProgressCard(nextStages) }
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
                ? { ...m, card: buildPipelineProgressCard(markAllComplete(initialStages)) }
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

            if (json.success && json.data) {
              const selection = selectPipelineCards(json.data)

              if (json.data.verdict) {
                const verdict = json.data.verdict
                const impactDelta = json.data.impactDelta ?? mapImpactDeltaData(signal, verdict)
                const reasoningTrace = mapReasoningTraceData({
                  signal,
                  verdict,
                  researchBrief: json.data.researchBrief,
                  intermediateArtifacts: json.data.intermediateArtifacts,
                  steps: reasoningSteps,
                })

                latestImpactDelta = impactDelta
                latestReasoningTrace = reasoningTrace

                // Verdict summary
                if (selection.showVerdictSummary) {
                  const netImpact = verdict.holdingImpacts
                    .map((h) => h.impact['1M']?.mid ?? 0)
                    .reduce((sum, v) => sum + v, 0)
                  const holdingCount = verdict.holdingImpacts.length
                  const avgConfidence = holdingCount > 0
                    ? verdict.holdingImpacts.reduce((sum, h) => sum + h.confidence, 0) / holdingCount
                    : 0
                  const direction: VerdictSummaryData['direction'] =
                    netImpact < -25 ? 'bearish' : netImpact > 25 ? 'bullish' : 'neutral'

                  next = upsertCardMessage(next, verdictSummaryId, {
                    type: 'verdict_summary',
                    data: { netImpact, holdingCount, direction, confidence: Math.round(avgConfidence * 100), signalHeadline: signal.headline },
                  })
                }

                if (selection.showImpactDelta) {
                  next = upsertCardMessage(next, impactDeltaId, {
                    type: 'signal_impact_delta',
                    data: impactDelta,
                  })
                }

                if (selection.showDebate && json.data.intermediateArtifacts?.debateResolution) {
                  next = upsertCardMessage(next, debateSummaryId, {
                    type: 'debate_summary',
                    data: json.data.intermediateArtifacts.debateResolution,
                  })
                }

                if (selection.showRecommendations) {
                  next = upsertCardMessage(next, recommendationId, {
                    type: 'recommendation',
                    data: verdict.recommendations,
                  })
                }

                // Transparency bar
                if (selection.showTransparencyBar) {
                  next = upsertCardMessage(next, transparencyBarId, {
                    type: 'transparency_bar',
                    data: {
                      agentCount: PIPELINE_STAGES.length,
                      debateRounds: json.data.intermediateArtifacts?.debateResolution?.rounds ?? 0,
                      qualityScore: verdict.qualityScore,
                      reasoningTrace,
                    },
                  })
                }
              }

              if (json.data.researchBrief) {
                next = upsertCardMessage(next, researchBriefId, {
                  type: 'research_brief',
                  data: json.data.researchBrief,
                })
              }
            }

            return next
          })

          // Data flows through card interactions to Action Center
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
    [isLoading, userId],
  )

  // ── Checkpoint Resume Flow ─────────────────────────────────
  // Called when user responds to a CheckpointCard or SoftCheckpointCard.
  // Opens a new SSE stream to the resume endpoint.

  const handleCheckpointSubmit = useCallback(
    async (value: string) => {
      if (!threadIdRef.current) return

      setIsLoading(true)
      shouldAutoScrollRef.current = true

      // Determine input type for the server
      const inputType: 'debate_correction' | 'scenario_preference' =
        ['base', 'downside', 'tail'].includes(value) ? 'scenario_preference' : 'debate_correction'

      // Resume pipeline progress animation
      const resumedStages = resumeFromCheckpoint(currentStagesRef.current)
      currentStagesRef.current = resumedStages
      const pId = progressIdRef.current

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pId
            ? { ...m, card: buildPipelineProgressCard(resumedStages) }
            : m,
        ),
      )

      try {
        const res = await fetch(`/api/v2/analyze/${threadIdRef.current}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ humanInput: value, inputType }),
        })

        if (!res.ok) {
          throw new Error(`Resume failed: ${res.status}`)
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response stream')

        const signal = activeSignalRef.current

        for await (const sseEvent of parseSseStream(reader)) {
          if (sseEvent.event === 'checkpoint') {
            // Another checkpoint (e.g., CP2 after CP1)
            const cpData = sseEvent.data as {
              stage: string
              type: 'hard' | 'soft'
              debateResolution?: unknown
              stressTest?: unknown
              [key: string]: unknown
            }

            const pausedStages = pauseAtCheckpoint(currentStagesRef.current)
            currentStagesRef.current = pausedStages

            setMessages((prev) => {
              let next = prev.map((m) =>
                m.id === pId
                  ? { ...m, card: buildPipelineProgressCard(pausedStages) }
                  : m,
              )

              if (cpData.stage === 'stress_test') {
                next = [
                  ...next,
                  {
                    id: uid('bridge'),
                    role: 'assistant' as const,
                    content: 'Here are the stress test scenarios. Which risk level do you want to plan for?',
                  },
                  {
                    id: uid('card-stress'),
                    role: 'assistant' as const,
                    content: '',
                    card: { type: 'stress_scenario' as const, data: cpData.stressTest },
                  },
                ]
              } else if (cpData.stage === 'debate_resolution') {
                next = [
                  ...next,
                  {
                    id: uid('card-cp'),
                    role: 'assistant' as const,
                    content: '',
                    card: {
                      type: 'checkpoint' as const,
                      data: {
                        stage: cpData.stage,
                        prompt: 'Approve the debate outcome or provide a correction.',
                        quickReplies: ['Looks good, continue', 'I disagree with the magnitude'],
                      },
                    },
                  },
                ]
              } else if (cpData.type === 'soft') {
                const softData: import('../chat-cards/types').SoftCheckpointData = {
                  stage: cpData.stage,
                  type: 'soft',
                  prompt: `Review ${cpData.stage.replace(/_/g, ' ')} before continuing.`,
                }
                next = [
                  ...next,
                  {
                    id: uid('card-soft-cp'),
                    role: 'assistant' as const,
                    content: '',
                    card: {
                      type: 'soft_checkpoint' as const,
                      data: softData,
                    },
                  },
                ]
              }

              return next
            })

            setIsLoading(false)
          } else if (sseEvent.event === 'complete') {
            // Pipeline completed after resume
            const finalStages = markAllComplete(currentStagesRef.current)
            currentStagesRef.current = finalStages
            const payload = sseEvent.data as AnalysisCompleteData

            setMessages((prev) => {
              let next = prev.map((m) =>
                m.id === pId
                  ? { ...m, card: buildPipelineProgressCard(finalStages) }
                  : m,
              )

              if (payload.verdict && signal) {
                const verdict = payload.verdict
                const selection = selectPipelineCards(payload)

                const impactDelta = payload.impactDelta ?? mapImpactDeltaData(signal, verdict)
                const reasoningTrace = mapReasoningTraceData({
                  signal,
                  verdict,
                  researchBrief: payload.researchBrief,
                  intermediateArtifacts: payload.intermediateArtifacts,
                  steps: [],
                })

                if (selection.showVerdictSummary) {
                  const netImpact = verdict.holdingImpacts
                    .map((h) => h.impact['1M']?.mid ?? 0)
                    .reduce((sum, v) => sum + v, 0)
                  const holdingCount = verdict.holdingImpacts.length
                  const avgConfidence = holdingCount > 0
                    ? verdict.holdingImpacts.reduce((sum, h) => sum + h.confidence, 0) / holdingCount
                    : 0
                  const direction: VerdictSummaryData['direction'] =
                    netImpact < -25 ? 'bearish' : netImpact > 25 ? 'bullish' : 'neutral'

                  next = upsertCardMessage(next, uid('card-verdict-summary'), {
                    type: 'verdict_summary',
                    data: { netImpact, holdingCount, direction, confidence: Math.round(avgConfidence * 100), signalHeadline: signal.headline },
                  })
                }

                if (selection.showImpactDelta) {
                  next = upsertCardMessage(next, uid('card-impact-delta'), {
                    type: 'signal_impact_delta',
                    data: impactDelta,
                  })
                }

                if (selection.showDebate && payload.intermediateArtifacts?.debateResolution) {
                  next = upsertCardMessage(next, uid('card-debate-summary'), {
                    type: 'debate_summary',
                    data: payload.intermediateArtifacts.debateResolution,
                  })
                }

                if (selection.showRecommendations) {
                  next = upsertCardMessage(next, uid('card-rec'), {
                    type: 'recommendation',
                    data: verdict.recommendations,
                  })
                }

                if (selection.showTransparencyBar) {
                  next = upsertCardMessage(next, uid('card-transparency-bar'), {
                    type: 'transparency_bar',
                    data: {
                      agentCount: PIPELINE_STAGES.length,
                      debateRounds: payload.intermediateArtifacts?.debateResolution?.rounds ?? 0,
                      qualityScore: verdict.qualityScore,
                      reasoningTrace,
                    },
                  })
                }

                const followUps = buildSignalAnalysisFollowUps(signal, verdict)
                const lastIdx = next.length - 1
                if (lastIdx >= 0 && next[lastIdx].card) {
                  next = [...next.slice(0, lastIdx), { ...next[lastIdx], suggestedFollowUps: [...followUps] }]
                }
              }

              if (payload.researchBrief) {
                next = upsertCardMessage(next, uid('card-brief'), {
                  type: 'research_brief',
                  data: payload.researchBrief,
                })
              }

              return next
            })

            setIsLoading(false)
            threadIdRef.current = null
            activeSignalRef.current = null
          } else if (sseEvent.event === 'error') {
            const errorData = sseEvent.data as { message?: string }
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pId
                  ? { ...m, card: buildPipelineProgressCard(currentStagesRef.current, errorData.message ?? 'Resume failed') }
                  : m,
              ),
            )
            setIsLoading(false)
          } else {
            // Progress events from resume stream
            const eventData = sseEvent.data as { stage?: string; message?: string }
            const stageId = eventData.stage ?? sseEvent.event
            const nextStages = advanceStages(currentStagesRef.current, stageId, eventData.message)
            currentStagesRef.current = nextStages

            setMessages((prev) =>
              prev.map((m) =>
                m.id === pId
                  ? { ...m, card: buildPipelineProgressCard(nextStages) }
                  : m,
              ),
            )
          }
        }
      } catch (error) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid('msg-error'),
            role: 'assistant' as const,
            content: `Resume failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ])
        setIsLoading(false)
      }
    },
    [],
  )

  // Legacy synthetic analysis, portfolio review, and general chat flows removed —
  // all routing now goes through POST /api/v2/chat (unified router).
  // The analyzeSignal function above is kept for the explicit "Analyze Impact" button.

  // ── Session auto-creation + LLM title generation ────────

  const generateSessionTitle = useCallback(
    (sessionId: string, message: string) => {
      fetch(`/api/v2/sessions/${userId}/${sessionId}/generate-title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
        .then((res) => res.json() as Promise<{ success: boolean; data?: { title: string } }>)
        .then((payload) => {
          if (payload.success && payload.data?.title) {
            onUpdateSession?.(sessionId, { title: payload.data.title })
          }
        })
        .catch(() => {
          // Title generation is best-effort — keep the placeholder title
        })
    },
    [userId, onUpdateSession],
  )

  // ── Unified Router: server decides which flow via POST /api/v2/chat ─────

  const handleSend = useCallback(
    async (content: string) => {
      if (isLoading) return

      // Create session if none active — guard against the session-change effect wiping state
      if (!activeSessionId && onCreateSession) {
        isSendingRef.current = true
        try {
          const newSessionId = await onCreateSession({
            type: 'general',
            title: 'New conversation',
          })
          generateSessionTitle(newSessionId, content)
        } catch {
          // Session creation failed — continue anyway
        }
      }

      setIsLoading(true)
      shouldAutoScrollRef.current = true

      const userMsg: EnhancedMessage = {
        id: uid('msg'),
        role: 'user',
        content,
      }

      // Initial thinking state — replaced once route_decision arrives
      const thinkingId = uid('card-thinking')
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: thinkingId,
          role: 'assistant',
          content: '',
          card: { type: 'thinking', data: { stage: 'routing', message: 'Prism is thinking...' } },
        },
      ])

      // State for pipeline mode
      let currentRoute: 'chat' | 'pipeline' | 'portfolio_review' = 'chat'
      const progressId = uid('card-progress')
      let currentStages = buildInitialStages()
      let reasoningSteps: ReasoningTraceStep[] = []
      let latestImpactDelta: SignalImpactDeltaData | undefined
      let latestReasoningTrace: ReasoningTraceData | undefined

      // Card IDs for pipeline mode
      const verdictSummaryId = uid('card-verdict-summary')
      const impactDeltaId = uid('card-impact-delta')
      const debateSummaryId = uid('card-debate-summary')
      const recommendationId = uid('card-rec')
      const researchBriefId = uid('card-brief')
      const transparencyBarId = uid('card-transparency-bar')

      // State for chat mode
      const assistantId = uid('msg-assistant')
      let chatAccumulated = ''

      const history = messages
        .filter((m) => m.role !== 'divider' && !m.card)
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-20) // Sliding window: cap at last 20 messages to control prompt size

      await sendUnifiedMessage(content, history, {
        onRouteDecision: (decision) => {
          currentRoute = decision.route
          if (decision.route === 'pipeline' || decision.route === 'portfolio_review') {
            // Replace thinking card with pipeline progress
            setMessages((prev) => prev.map((m) =>
              m.id === thinkingId
                ? { ...m, id: progressId, card: buildPipelineProgressCard(currentStages) }
                : m,
            ))
          } else {
            // Chat route — replace thinking card with streaming text message
            setMessages((prev) => [
              ...prev.filter((m) => m.id !== thinkingId),
              { id: assistantId, role: 'assistant' as const, content: '', isStreaming: true },
            ])
          }
        },

        onChatChunk: (data: ChatChunkData) => {
          if (data.suggestions) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, suggestedFollowUps: data.suggestions }
                  : m,
              ),
            )
          } else if (data.text) {
            chatAccumulated += data.text
            const snapshot = chatAccumulated
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: snapshot, isStreaming: true } : m,
              ),
            )
          }
        },

        // Structured response replaces accumulated text after streaming completes
        onChatStructured: (data: ChatChunkData) => {
          if (data.structured) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: '',
                      isStreaming: false,
                      card: { type: 'structured_response' as const, data: data.structured! },
                      suggestedFollowUps: data.structured!.followUps?.map((f) => f.text),
                    }
                  : m,
              ),
            )
          }
        },

        onChatComplete: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, isStreaming: false } : m,
            ),
          )
          setIsLoading(false)
        },

        onPipelineProgress: (stage, data) => {
          const eventData = data as { stage?: string; message?: string }
          const stageId = eventData.stage ?? stage
          const nextStages = advanceStages(currentStages, stageId, eventData.message)
          currentStages = nextStages
          setMessages((prev) =>
            prev.map((m) =>
              m.id === progressId ? { ...m, card: buildPipelineProgressCard(nextStages) } : m,
            ),
          )
        },

        onAgentThinking: (data) => {
          if (data.text) {
            currentStages = updateThinkingText(currentStages, data.stage, data.text)
            setMessages((prev) =>
              prev.map((m) =>
                m.id === progressId ? { ...m, card: buildPipelineProgressCard(currentStages) } : m,
              ),
            )
          }
        },

        onImpactDelta: (data) => {
          latestImpactDelta = data as SignalImpactDeltaData
          setMessages((prev) =>
            upsertCardMessage(prev, impactDeltaId, { type: 'signal_impact_delta', data: data as SignalImpactDeltaData }),
          )
        },

        onPlaybook: (_data) => {
          // Playbook data absorbed into RecommendationCard
        },

        onTraceStep: (data) => {
          reasoningSteps = [...reasoningSteps, data as ReasoningTraceStep]
        },

        onComplete: (data) => {
          if (currentRoute === 'portfolio_review') {
            // Portfolio review complete
            const finalStages = markAllComplete(currentStages)
            setMessages((prev) => [
              ...prev.map((m) =>
                m.id === progressId ? { ...m, card: buildPipelineProgressCard(finalStages) } : m,
              ),
              {
                id: uid('card-portfolio'),
                role: 'assistant' as const,
                content: '',
                card: { type: 'portfolio_review' as const, data },
                suggestedFollowUps: buildPortfolioReviewFollowUps(data),
              },
            ])
          } else {
            // Single-signal pipeline complete
            const finalStages = markAllComplete(currentStages)
            const payload = data as AnalysisCompleteData
            const selection = selectPipelineCards(payload)

            setMessages((prev) => {
              let next = prev.map((m) =>
                m.id === progressId ? { ...m, card: buildPipelineProgressCard(finalStages) } : m,
              )

              if (payload.verdict) {
                const verdict = payload.verdict
                const syntheticSignal = { id: 'unified', headline: content } as Signal
                const impactDelta = latestImpactDelta ?? mapImpactDeltaData(syntheticSignal, verdict)
                const reasoningTrace = mapReasoningTraceData({
                  signal: syntheticSignal,
                  verdict,
                  researchBrief: payload.researchBrief,
                  intermediateArtifacts: payload.intermediateArtifacts,
                  steps: reasoningSteps,
                })
                latestImpactDelta = impactDelta
                latestReasoningTrace = reasoningTrace

                if (selection.showVerdictSummary) {
                  const netImpact = verdict.holdingImpacts
                    .map((h) => h.impact['1M']?.mid ?? 0)
                    .reduce((sum, v) => sum + v, 0)
                  const holdingCount = verdict.holdingImpacts.length
                  const avgConfidence = holdingCount > 0
                    ? verdict.holdingImpacts.reduce((sum, h) => sum + h.confidence, 0) / holdingCount
                    : 0
                  const direction: VerdictSummaryData['direction'] =
                    netImpact < -25 ? 'bearish' : netImpact > 25 ? 'bullish' : 'neutral'

                  next = upsertCardMessage(next, verdictSummaryId, {
                    type: 'verdict_summary',
                    data: { netImpact, holdingCount, direction, confidence: Math.round(avgConfidence * 100), signalHeadline: content },
                  })
                }

                if (selection.showImpactDelta) {
                  next = upsertCardMessage(next, impactDeltaId, { type: 'signal_impact_delta', data: impactDelta })
                }

                if (selection.showDebate && payload.intermediateArtifacts?.debateResolution) {
                  next = upsertCardMessage(next, debateSummaryId, {
                    type: 'debate_summary', data: payload.intermediateArtifacts.debateResolution,
                  })
                }

                if (selection.showRecommendations) {
                  next = upsertCardMessage(next, recommendationId, { type: 'recommendation', data: verdict.recommendations })
                }
              }

              if (payload.researchBrief) {
                next = upsertCardMessage(next, researchBriefId, { type: 'research_brief', data: payload.researchBrief })
              }

              if (selection.showTransparencyBar && latestReasoningTrace) {
                next = upsertCardMessage(next, transparencyBarId, {
                  type: 'transparency_bar',
                  data: {
                    agentCount: PIPELINE_STAGES.length,
                    debateRounds: payload.intermediateArtifacts?.debateResolution?.rounds ?? 0,
                    qualityScore: payload.verdict?.qualityScore ?? 0,
                    reasoningTrace: latestReasoningTrace,
                  },
                })
              }

              // Attach follow-ups to last card
              if (payload.verdict) {
                const syntheticSignal = { id: 'unified', headline: content } as Signal
                const followUps = buildSignalAnalysisFollowUps(syntheticSignal, payload.verdict)
                const lastIdx = next.length - 1
                if (lastIdx >= 0 && next[lastIdx].card) {
                  next = [...next.slice(0, lastIdx), { ...next[lastIdx], suggestedFollowUps: [...followUps] }]
                }
              }

              return next
            })
          }
          setIsLoading(false)
        },

        onError: (errorMessage) => {
          if (currentRoute === 'chat') {
            setMessages((prev) => [
              ...prev.filter((m) => m.id !== thinkingId && m.id !== assistantId),
              { id: uid('msg-error'), role: 'assistant' as const, content: `Sorry, something went wrong: ${errorMessage}` },
            ])
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === progressId
                  ? { ...m, card: buildPipelineProgressCard(currentStages, errorMessage) }
                  : m,
              ),
            )
          }
          setIsLoading(false)
        },
      })

      // If no explicit completion came from the stream, ensure loading stops
      setIsLoading(false)
      isSendingRef.current = false
    },
    [isLoading, messages, userId, activeSessionId, onCreateSession, generateSessionTitle, sendUnifiedMessage],
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

  // Track latest recommendations for save-plan flow
  const latestRecommendationsRef = useRef<readonly import('@prism/shared').Recommendation[]>([])

  useEffect(() => {
    const recMsg = messages.find((m) => m.card?.type === 'recommendation')
    if (recMsg?.card?.type === 'recommendation') {
      latestRecommendationsRef.current = recMsg.card.data
    }
  }, [messages])

  const handleSavePlan = useCallback(
    (recommendationId: string) => {
      const recs = latestRecommendationsRef.current
      onSavePlan?.(recommendationId, recs)

      const rec = recs.find((r) => r.id === recommendationId)
      if (rec) {
        setMessages((prev) => [
          ...prev,
          {
            id: uid('msg-saved'),
            role: 'assistant',
            content: `Plan saved: "${rec.title}" has been added to your planned changes. Check the Holdings panel to review.`,
          },
        ])
      }
    },
    [onSavePlan],
  )

  const greeting = `${getGreeting()}${userName ? `, ${userName}` : ''}`

  return (
    <div
      className="chat-area"
      ref={messagesContainerRef}
      onScroll={handleMessagesScroll}
      onWheel={handleMessagesWheel}
    >
      {showWelcome ? (
        <div className="chat-area__welcome">
          <h1 className="chat-area__greeting-text">{greeting}</h1>

          <div className="chat-area__welcome-input">
            <ChatInput onSend={handleSend} disabled={isLoading} />
          </div>

          <div className="chat-area__category-pills">
            {CATEGORY_PILLS.map((pill) => (
              <button
                key={pill.label}
                type="button"
                className="chat-area__category-pill"
                onClick={() => handleSend(pill.prompt)}
              >
                <span className="chat-area__pill-icon">{pill.icon}</span>
                {pill.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="chat-area__messages">
          {messages.map((msg) => {
            if (msg.card) {
              const followUps = msg.suggestedFollowUps ?? []
              return (
                <div key={msg.id} className="chat-area__card-wrapper">
                  <ChatCardRenderer
                    card={msg.card}
                    onCheckpointSubmit={handleCheckpointSubmit}
                    onSignalAnalyze={handleAnalyzeSignal}
                    onSavePlan={handleSavePlan}
                    onFollowUp={handleSend}
                    onActionCenterMode={onActionCenterMode}
                  />
                  {followUps.length > 0 && (
                    <div className="chat-message__suggestion-pills">
                      {followUps.map((query) => (
                        <button
                          key={query}
                          className="chat-message__suggestion-pill"
                          onClick={() => handleSend(query)}
                        >
                          {query}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }
            return <ChatMessage key={msg.id} message={msg} onFollowUp={handleSend} />
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
      {!showWelcome && (
        <div className="chat-area__input">
          <ChatInput onSend={handleSend} disabled={isLoading} />
          <p className="chat-area__disclaimer">
            Prism provides analysis, not financial advice. Always verify before acting.
          </p>
        </div>
      )}
    </div>
  )
}
