// ChatArea — main chat message stream with input.
// Shows a structured welcome screen when no messages, then transitions to chat.
// Unified: all messages flow through POST /api/v2/chat (router agent decides pipeline vs chat).

import { useRef, useEffect, useCallback, useState, type MutableRefObject, type WheelEvent } from 'react'
import { ChatInput } from '../chat/ChatInput'
import { ChatMessage } from '../chat/ChatMessage'
import { ChatCardRenderer } from '../chat-cards/ChatCardRenderer'
import { CollapsibleReasoning } from '../chat-cards/CollapsibleReasoning'
import type { ChatMessage as ChatMessageType } from '../../hooks/useChat'
import type { Signal } from '@prism/shared'
import { useUnifiedChat, type ChatChunkData } from '../../hooks/useUnifiedChat'
import type {
  ActionCenterMode,
  AnalysisCompleteData,
  ChatCard,
  PipelineStageInfo,
  ReasoningTraceStep,
  SignalImpactDeltaData,
} from '../chat-cards/types'
import {
  mapImpactDeltaData,
} from '../chat-cards/mappers'
import {
  buildPortfolioReviewFollowUps,
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
  readonly thinkingDurationSec?: number
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

  return stages.map((s, i) => {
    if (i === targetIdx) {
      // Don't overwrite thinking text on stages that already completed
      if (s.status === 'complete') return s
      // Auto-promote pending → active when we receive thinking text
      const newStatus = s.status === 'pending' ? 'active' as const : s.status
      // Append to thinking history (deduplicate consecutive duplicates)
      const prevHistory = s.thinkingHistory ?? []
      const lastEntry = prevHistory[prevHistory.length - 1]
      const history = lastEntry === text ? prevHistory : [...prevHistory, text]
      return { ...s, thinkingText: text, status: newStatus, thinkingHistory: history }
    }
    // Mark prior pending stages as complete (node is running, so predecessors must be done)
    if (i < targetIdx && s.status === 'pending') {
      return { ...s, status: 'complete' as const }
    }
    return s
  })
}

// Shared headline for the current pipeline run (set when signal is available)
let currentSignalHeadline = ''

// Mutable store for intermediate artifacts — accumulated as checkpoint events arrive.
// These get forwarded into the AgentProgressGroupData so the inline progress card
// can open the right-panel drawer with full analyst/debate/challenge details.
let currentIntermediateArtifacts: {
  analystAssessments?: readonly import('@prism/shared').AnalystAssessment[]
  riskChallenge?: import('@prism/shared').RiskChallenge
  debateResolution?: import('@prism/shared').DebateResolution
  magnitudeValidation?: import('@prism/shared').MagnitudeValidation
  stressTest?: import('@prism/shared').StressTestResult
} = {}

function buildPipelineProgressCard(
  stages: readonly PipelineStageInfo[],
  error?: string,
): ChatCard {
  // When there's an error, mark the active stage as failed
  const finalStages = error
    ? stages.map((s) =>
        s.status === 'active'
          ? { ...s, status: 'complete' as const, message: error }
          : s,
      )
    : stages

  return {
    type: 'agent_progress_group',
    data: {
      signalHeadline: currentSignalHeadline,
      stages: finalStages.map((s) => ({
        id: s.id,
        label: s.label,
        status: s.status === 'waiting' ? 'pending' as const : s.status as 'pending' | 'active' | 'complete',
        thinkingText: s.thinkingText,
        thinkingHistory: s.thinkingHistory,
        completionMessage: s.message,
        expandable: true,
      })),
      isComplete: finalStages.every((s) => s.status === 'complete'),
      error,
      intermediateArtifacts: Object.keys(currentIntermediateArtifacts).length > 0
        ? { ...currentIntermediateArtifacts }
        : undefined,
    },
  }
}

// ── Checkpoint Prompt Builders ──────────────────────────────

interface CheckpointPayload {
  readonly stage: string
  readonly type: 'hard' | 'soft'
  readonly debateResolution?: unknown
  readonly analystAssessments?: unknown
  readonly riskProfile?: unknown
  readonly riskChallenge?: unknown
  readonly [key: string]: unknown
}

function accumulateArtifacts(data: Record<string, unknown>): void {
  const assessments = data.analystAssessments as import('@prism/shared').AnalystAssessment[] | undefined
  const riskChallenge = data.riskChallenge as import('@prism/shared').RiskChallenge | undefined
  const debate = data.debateResolution as import('@prism/shared').DebateResolution | undefined
  const magnitudeValidation = data.magnitudeValidation as import('@prism/shared').MagnitudeValidation | undefined
  const stressTest = data.stressTest as import('@prism/shared').StressTestResult | undefined
  if (assessments) currentIntermediateArtifacts = { ...currentIntermediateArtifacts, analystAssessments: assessments }
  if (riskChallenge) currentIntermediateArtifacts = { ...currentIntermediateArtifacts, riskChallenge }
  if (debate) currentIntermediateArtifacts = { ...currentIntermediateArtifacts, debateResolution: debate }
  if (magnitudeValidation) currentIntermediateArtifacts = { ...currentIntermediateArtifacts, magnitudeValidation }
  if (stressTest) currentIntermediateArtifacts = { ...currentIntermediateArtifacts, stressTest }
}

function buildSoftCheckpointData(cpData: CheckpointPayload): import('../chat-cards/types').SoftCheckpointData {
  const assessments = cpData.analystAssessments as import('@prism/shared').AnalystAssessment[] | undefined
  const riskProfile = cpData.riskProfile as import('@prism/shared').InferredRiskProfile | undefined
  const riskChallenge = cpData.riskChallenge as import('@prism/shared').RiskChallenge | undefined

  let prompt: string
  if (cpData.stage === 'analyst_review' && assessments?.length) {
    const summaries = assessments.map((a) =>
      `${a.analystType} ${a.overallDirection}`,
    )
    prompt = `4 analysts assessed: ${summaries.join(', ')}. Review their perspectives before the debate.`
  } else if (cpData.stage === 'risk_challenge_review' && riskChallenge) {
    const count = riskChallenge.challengedAssumptions.length
    const adj = Math.round(riskChallenge.recommendedConfidenceAdjustment * 100)
    prompt = `Risk team challenged ${count} assumption${count !== 1 ? 's' : ''}, ${adj}% confidence adjustment. Review before final synthesis.`
  } else {
    prompt = `Review ${cpData.stage.replace(/_/g, ' ')} before continuing.`
  }

  return {
    stage: cpData.stage,
    type: 'soft',
    prompt,
    analystAssessments: assessments,
    riskProfile,
    riskChallenge,
  }
}

function buildDebateCheckpointData(cpData: CheckpointPayload): import('../chat-cards/types').CheckpointCardData {
  const debate = cpData.debateResolution as import('@prism/shared').DebateResolution | undefined
  const direction = debate?.consensusDirection ?? 'unknown'
  const confidence = debate ? Math.round(debate.consensusConfidence * 100) : 0
  const unresolvedCount = debate?.unresolvedDisagreements?.length ?? 0

  const prompt = debate
    ? `Debate concluded ${direction} (${confidence}% confidence). ${unresolvedCount > 0 ? `${unresolvedCount} unresolved disagreement${unresolvedCount > 1 ? 's' : ''}.` : 'Full consensus reached.'} Does this match your expectation?`
    : 'Approve the debate outcome or provide a correction.'

  const quickReplies = debate
    ? [
        `${direction.charAt(0).toUpperCase() + direction.slice(1)} looks right`,
        'Overstated — impact will be smaller',
        'Understated — impact will be larger',
        'I have additional context',
      ]
    : ['Looks good, continue', 'I disagree with the magnitude', 'The timing assumption is wrong']

  return {
    stage: 'debate_resolution',
    prompt,
    quickReplies,
    summary: debate ? { direction, confidence, unresolvedCount } : undefined,
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
  const sendCreatedSessionRef = useRef<string | null>(null) // Session ID created by the active send flow
  const threadIdRef = useRef<string | null>(null)
  const currentStagesRef = useRef<PipelineStageInfo[]>([])
  const progressIdRef = useRef<string>('')
  const activeSignalRef = useRef<Signal | null>(null)
  const { sendMessage: sendUnifiedMessage, abort: abortUnified } = useUnifiedChat(userId)

  // Client-side message cache keyed by session ID — survives session switches
  const messageCacheRef = useRef<Map<string, readonly EnhancedMessage[]>>(new Map())
  const prevSessionIdRef = useRef<string | null>(null)

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

  // Keep cache in sync: whenever messages change, update the cache for the active session.
  // Guard: only cache when we're settled in a session (prevSessionIdRef matches).
  // Without this guard, a session switch (A→B) causes this effect to run BEFORE the
  // session-switch effect below, caching A's stale messages under B's ID.
  useEffect(() => {
    if (activeSessionId && messages.length > 0 && activeSessionId === prevSessionIdRef.current) {
      messageCacheRef.current.set(activeSessionId, messages)
    }
  }, [messages, activeSessionId])

  // On session switch: abort streams, restore or clear incoming session's messages.
  // Skip ONLY when the session change was triggered by the active send flow's own session creation
  // (e.g., analyzeSignal creates a session mid-send — that transition should not wipe messages).
  // Manual switches (clicking "New session" or a different session) must always go through.
  useEffect(() => {
    // If a send flow just created this exact session, skip the reset — the send flow manages its own messages
    if (isSendingRef.current && activeSessionId === sendCreatedSessionRef.current) {
      sendCreatedSessionRef.current = null
      prevSessionIdRef.current = activeSessionId
      return
    }

    prevSessionIdRef.current = activeSessionId

    // Abort any in-flight streams (SSE, unified chat)
    abortRef.current?.abort()
    abortRef.current = null
    abortUnified()
    setIsLoading(false)
    isSendingRef.current = false
    shouldAutoScrollRef.current = true

    // Restore cached messages for the new session, or start fresh
    if (activeSessionId) {
      const cached = messageCacheRef.current.get(activeSessionId)
      setMessages(cached ?? [])
    } else {
      setMessages([])
    }
  }, [activeSessionId, userId, abortUnified])

  // Clear message cache when user changes (different user = different sessions)
  useEffect(() => {
    messageCacheRef.current.clear()
  }, [userId])

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

      // Always create a dedicated session for signal analysis
      if (onCreateSession) {
        isSendingRef.current = true
        try {
          const createdId = await onCreateSession({
            type: 'signal',
            title: signal.headline,
            signalId: signal.id,
          })
          sendCreatedSessionRef.current = createdId
          // Clear old session's messages — isSendingRef blocks the effect from doing this
          setMessages([])
        } catch {
          // Session creation failed — continue with analysis anyway
        }
      }

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      let latestImpactDelta: SignalImpactDeltaData | undefined
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
      const traceNavigatorId = uid('card-trace-nav')
      const reasoningTraceId = uid('card-reasoning-trace')
      const initialStages = buildInitialStages()
      currentSignalHeadline = signal.headline
      currentIntermediateArtifacts = {}
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
              const cpData = sseEvent.data as CheckpointPayload
              accumulateArtifacts(cpData)

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
                        data: buildDebateCheckpointData(cpData),
                      },
                    },
                  ]
                } else if (cpData.type === 'soft') {
                  next = [
                    ...next,
                    {
                      id: uid('card-soft-cp'),
                      role: 'assistant' as const,
                      content: '',
                      card: {
                        type: 'soft_checkpoint' as const,
                        data: buildSoftCheckpointData(cpData),
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
              // Pipeline finished — consolidated analysis report card
              const finalStages = markAllComplete(currentStages)
              const payload = sseEvent.data as AnalysisCompleteData

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

                  latestImpactDelta = impactDelta

                  const debateRounds = payload.intermediateArtifacts?.debateResolution?.rounds ?? 0
                  const qualityScore = Math.round((payload.verdict?.qualityScore ?? 0) * 100)

                  // Single consolidated analysis report card
                  next = upsertCardMessage(next, impactDeltaId, {
                    type: 'analysis_report',
                    data: {
                      signal: { id: signal.id, headline: signal.headline },
                      verdict,
                      impactDelta,
                      intermediateArtifacts: payload.intermediateArtifacts,
                      researchBrief: payload.researchBrief,
                      qualityScore,
                      agentCount: PIPELINE_STAGES.length,
                      debateRounds,
                    },
                  })
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
              const eventData = sseEvent.data as Record<string, unknown>
              const stageId = (eventData.stage as string | undefined) ?? sseEvent.event
              const message = eventData.message as string | undefined
              // Accumulate any artifact data attached to progress events
              accumulateArtifacts(eventData)
              const nextStages = advanceStages(currentStages, stageId, message)
              currentStages = nextStages

              // Update progress bar only (ThinkingCards removed — replaced by inline agent stream)
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

            if (json.success && json.data && json.data.verdict) {
              const verdict = json.data.verdict
              const impactDelta = json.data.impactDelta ?? mapImpactDeltaData(signal, verdict)
              latestImpactDelta = impactDelta

              const debateRounds = json.data.intermediateArtifacts?.debateResolution?.rounds ?? 0
              const qualityScore = Math.round((verdict.qualityScore ?? 0) * 100)

              next = upsertCardMessage(next, impactDeltaId, {
                type: 'analysis_report',
                data: {
                  signal: { id: signal.id, headline: signal.headline },
                  verdict,
                  impactDelta,
                  intermediateArtifacts: json.data.intermediateArtifacts,
                  researchBrief: json.data.researchBrief,
                  qualityScore,
                  agentCount: PIPELINE_STAGES.length,
                  debateRounds,
                },
              })
            }

            return next
          })

          // Data flows through card interactions to Action Center
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          isSendingRef.current = false
          return
        }
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
      isSendingRef.current = false
    },
    [isLoading, userId, onCreateSession],
  )

  // ── Checkpoint Resume Flow ─────────────────────────────────
  // Called when user responds to a CheckpointCard or SoftCheckpointCard.
  // Opens a new SSE stream to the resume endpoint.

  const handleCheckpointSubmit = useCallback(
    async (value: string) => {
      if (!threadIdRef.current) return

      setIsLoading(true)
      shouldAutoScrollRef.current = true

      // Only debate_correction checkpoint remains (stress_test checkpoint removed)
      const inputType = 'debate_correction' as const

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
            const cpData = sseEvent.data as CheckpointPayload
            accumulateArtifacts(cpData)

            const pausedStages = pauseAtCheckpoint(currentStagesRef.current)
            currentStagesRef.current = pausedStages

            setMessages((prev) => {
              let next = prev.map((m) =>
                m.id === pId
                  ? { ...m, card: buildPipelineProgressCard(pausedStages) }
                  : m,
              )

              if (cpData.stage === 'debate_resolution') {
                next = [
                  ...next,
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
                      data: buildDebateCheckpointData(cpData),
                    },
                  },
                ]
              } else if (cpData.type === 'soft') {
                next = [
                  ...next,
                  {
                    id: uid('card-soft-cp'),
                    role: 'assistant' as const,
                    content: '',
                    card: {
                      type: 'soft_checkpoint' as const,
                      data: buildSoftCheckpointData(cpData),
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
                const impactDelta = payload.impactDelta ?? mapImpactDeltaData(signal, verdict)
                const debateRounds = payload.intermediateArtifacts?.debateResolution?.rounds ?? 0
                const qualityScore = Math.round((verdict.qualityScore ?? 0) * 100)

                // Single consolidated analysis report card
                next = upsertCardMessage(next, uid('card-report'), {
                  type: 'analysis_report',
                  data: {
                    signal: { id: signal.id, headline: signal.headline },
                    verdict,
                    impactDelta,
                    intermediateArtifacts: payload.intermediateArtifacts,
                    researchBrief: payload.researchBrief,
                    qualityScore,
                    agentCount: PIPELINE_STAGES.length,
                    debateRounds,
                  },
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
            const eventData = sseEvent.data as Record<string, unknown>
            const stageId = (eventData.stage as string | undefined) ?? sseEvent.event
            const message = eventData.message as string | undefined
            // Accumulate any artifact data attached to progress events
            accumulateArtifacts(eventData)
            const nextStages = advanceStages(currentStagesRef.current, stageId, message)
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
          sendCreatedSessionRef.current = newSessionId
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
      const impactDeltaId = uid('card-impact-delta')

      // State for chat mode — reuse thinkingId so React doesn't remount (prevents flash)
      const assistantId = thinkingId
      let chatAccumulated = ''
      let thinkingAccumulated = ''
      let thinkingStartedAt: number | null = null

      const history = messages
        .filter((m) => m.role !== 'divider' && !m.card)
        .map((m) => ({ role: m.role, content: m.content }))
        .slice(-20) // Sliding window: cap at last 20 messages to control prompt size

      await sendUnifiedMessage(content, history, {
        onRouteDecision: (decision) => {
          currentRoute = decision.route
          if (decision.route === 'pipeline' || decision.route === 'portfolio_review') {
            // Set headline for progress display
            currentSignalHeadline = content.slice(0, 80)
            currentIntermediateArtifacts = {}
            // Store refs for checkpoint resume flow
            currentStagesRef.current = currentStages
            progressIdRef.current = progressId
            // Replace thinking card with pipeline progress
            setMessages((prev) => prev.map((m) =>
              m.id === thinkingId
                ? { ...m, id: progressId, card: buildPipelineProgressCard(currentStages) }
                : m,
            ))
          } else {
            // Chat route — replace thinking card with the assistant message (reuse same ID)
            setMessages((prev) => prev.map((m) =>
              m.id === thinkingId
                ? { ...m, id: assistantId, content: '', isStreaming: true, card: { type: 'thinking' as const, data: { stage: 'thinking', message: 'Prism is thinking...' } } }
                : m,
            ))
          }
        },

        // Real thinking tokens from Gemini — stream into the thinking card
        onChatThinking: (data: ChatChunkData) => {
          if (data.text) {
            if (thinkingStartedAt === null) thinkingStartedAt = Date.now()
            thinkingAccumulated += data.text
            const snapshot = thinkingAccumulated
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, card: { type: 'thinking' as const, data: { stage: 'thinking', message: snapshot } } }
                  : m,
              ),
            )
          }
        },

        onChatChunk: (data: ChatChunkData) => {
          // replaceText: server sends cleaned text (without >> suggestion lines) after streaming
          if (data.replaceText !== undefined) {
            chatAccumulated = data.replaceText
            const snapshot = chatAccumulated
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: snapshot, card: undefined, isStreaming: false, ...(data.suggestions ? { suggestedFollowUps: data.suggestions } : {}) }
                  : m,
              ),
            )
          } else if (data.suggestions) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, suggestedFollowUps: data.suggestions }
                  : m,
              ),
            )
          } else if (data.text) {
            chatAccumulated += data.text
            // If text looks like JSON, keep the thinking card visible — structured card will replace it
            const trimmed = chatAccumulated.trimStart()
            const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('```')
            if (!looksLikeJson) {
              // Plain text response — transition from thinking card to regular text message
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: chatAccumulated, card: undefined, isStreaming: true } : m,
                ),
              )
            }
            // If JSON: silently accumulate, thinking card stays visible
          }
        },

        // Structured response: transition thinking card → structured card with collapsible thinking
        onChatStructured: (data: ChatChunkData) => {
          if (data.structured) {
            const thinking = (data.thinkingText ?? thinkingAccumulated).trim()
            const durationSec = thinkingStartedAt != null
              ? (Date.now() - thinkingStartedAt) / 1000
              : undefined
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: thinking,
                      isStreaming: false,
                      thinkingDurationSec: durationSec,
                      card: { type: 'structured_response' as const, data: data.structured! },
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
          const eventData = data as Record<string, unknown>
          const stageId = (eventData.stage as string | undefined) ?? stage
          const message = eventData.message as string | undefined
          // Accumulate any artifact data attached to progress events
          accumulateArtifacts(eventData)
          const nextStages = advanceStages(currentStages, stageId, message)
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
            currentStagesRef.current = currentStages
            setMessages((prev) =>
              prev.map((m) =>
                m.id === progressId ? { ...m, card: buildPipelineProgressCard(currentStages) } : m,
              ),
            )
          }
        },

        onThreadId: (threadId) => {
          threadIdRef.current = threadId
        },

        onCheckpoint: (cpData) => {
          // Pause pipeline progress at checkpoint
          currentStages = pauseAtCheckpoint(currentStages)
          currentStagesRef.current = currentStages
          const cpPayload = cpData as CheckpointPayload
          accumulateArtifacts(cpPayload)

          setMessages((prev) => {
            let next = prev.map((m) =>
              m.id === progressId
                ? { ...m, card: buildPipelineProgressCard(currentStages) }
                : m,
            )

            if (cpPayload.stage === 'debate_resolution') {
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
                  card: { type: 'debate_summary' as const, data: cpPayload.debateResolution },
                },
                {
                  id: uid('card-cp'),
                  role: 'assistant' as const,
                  content: '',
                  card: {
                    type: 'checkpoint' as const,
                    data: buildDebateCheckpointData(cpPayload),
                  },
                },
              ]
            } else if (cpPayload.type === 'soft') {
              next = [
                ...next,
                {
                  id: uid('card-soft-cp'),
                  role: 'assistant' as const,
                  content: '',
                  card: {
                    type: 'soft_checkpoint' as const,
                    data: buildSoftCheckpointData(cpPayload),
                  },
                },
              ]
            }

            return next
          })

          setIsLoading(false)
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
            // Single-signal pipeline complete — consolidated report card
            const finalStages = markAllComplete(currentStages)
            const payload = data as AnalysisCompleteData

            setMessages((prev) => {
              let next = prev.map((m) =>
                m.id === progressId ? { ...m, card: buildPipelineProgressCard(finalStages) } : m,
              )

              if (payload.verdict) {
                const verdict = payload.verdict
                const syntheticSignal = { id: 'unified', headline: content } as Signal
                const impactDelta = latestImpactDelta ?? mapImpactDeltaData(syntheticSignal, verdict)
                latestImpactDelta = impactDelta

                const debateRounds = payload.intermediateArtifacts?.debateResolution?.rounds ?? 0
                const qualityScore = Math.round((payload.verdict?.qualityScore ?? 0) * 100)

                next = upsertCardMessage(next, impactDeltaId, {
                  type: 'analysis_report',
                  data: {
                    signal: { id: 'unified', headline: content },
                    verdict,
                    impactDelta,
                    intermediateArtifacts: payload.intermediateArtifacts,
                    researchBrief: payload.researchBrief,
                    qualityScore,
                    agentCount: PIPELINE_STAGES.length,
                    debateRounds,
                  },
                })
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
              const hasReasoning = msg.card.type === 'structured_response' && msg.content.trim().length > 0
              return (
                <div key={msg.id} className="chat-area__card-wrapper">
                  {hasReasoning && <CollapsibleReasoning text={msg.content} durationSec={msg.thinkingDurationSec} />}
                  <ChatCardRenderer
                    card={msg.card}
                    onCheckpointSubmit={handleCheckpointSubmit}
                    onSignalAnalyze={handleAnalyzeSignal}
                    onSavePlan={handleSavePlan}
                    onFollowUp={handleSend}
                    onActionCenterMode={onActionCenterMode}
                  />
                  {followUps.length > 0 && (
                    <div className="chat-message__follow-ups">
                      <span className="chat-message__follow-ups-label">Follow-ups</span>
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
