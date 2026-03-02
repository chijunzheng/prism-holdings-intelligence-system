// Personal Context Store — in-memory store for user corrections, analysis memory, and assertions.
// Demo-scale: Map<userId, PersonalContext>. JSON-serializable for future persistence.

import { randomUUID } from 'crypto'
import type {
  PersonalContext,
  CorrectionEntry,
  AnalysisMemoryEntry,
  UserAssertion,
  WatchedSignal,
  FundManagerVerdict,
  Signal,
} from '@prism/shared'

const MAX_ANALYSIS_MEMORY = 20
const MAX_CORRECTIONS_IN_PROMPT = 5
const MAX_ANALYSIS_IN_PROMPT = 5
const CORRECTION_DECAY_PER_DAY = 0.1
const CORRECTION_MIN_CONFIDENCE = 0.2
const TOKEN_BUDGET_CORRECTIONS = 500
const TOKEN_BUDGET_ANALYSIS = 1000
const TOKEN_BUDGET_ASSERTIONS = 800

const store = new Map<string, PersonalContext>()

export function getPersonalContext(userId: string): PersonalContext {
  const existing = store.get(userId)
  if (existing) return existing

  const empty: PersonalContext = {
    userId,
    corrections: [],
    analysisMemory: [],
    assertions: [],
    watchedSignals: [],
    updatedAt: new Date().toISOString(),
  }
  store.set(userId, empty)
  return empty
}

export function addCorrection(
  userId: string,
  correction: Omit<CorrectionEntry, 'id' | 'createdAt' | 'confidence'> & { confidence?: number },
): PersonalContext {
  const ctx = getPersonalContext(userId)
  const entry: CorrectionEntry = {
    ...correction,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    confidence: correction.confidence ?? 1.0,
  }
  const updated: PersonalContext = {
    ...ctx,
    corrections: [...ctx.corrections, entry],
    updatedAt: new Date().toISOString(),
  }
  store.set(userId, updated)
  return updated
}

export function addAnalysisMemory(
  userId: string,
  signal: Pick<Signal, 'id' | 'headline'>,
  verdict: FundManagerVerdict,
  userAction: AnalysisMemoryEntry['userAction'],
): PersonalContext {
  const ctx = getPersonalContext(userId)

  const netImpact = verdict.holdingImpacts
    .map((h) => h.impact['1M']?.mid ?? 0)
    .reduce((sum, v) => sum + v, 0)

  const direction = netImpact < -25 ? 'negative' as const
    : netImpact > 25 ? 'positive' as const
    : 'neutral' as const

  const topHoldings = [...verdict.holdingImpacts]
    .sort((a, b) => Math.abs(b.impact['1M']?.mid ?? 0) - Math.abs(a.impact['1M']?.mid ?? 0))
    .slice(0, 3)
    .map((h) => ({ ticker: h.ticker, impactMid: h.impact['1M']?.mid ?? 0 }))

  const entry: AnalysisMemoryEntry = {
    signalId: signal.id,
    headline: signal.headline,
    verdictDirection: direction,
    oneMonthImpactMid: Math.round(netImpact),
    userAction,
    completedAt: new Date().toISOString(),
    topHoldings,
  }

  // FIFO: keep last N entries
  const memory = [...ctx.analysisMemory, entry].slice(-MAX_ANALYSIS_MEMORY)

  const updated: PersonalContext = {
    ...ctx,
    analysisMemory: memory,
    updatedAt: new Date().toISOString(),
  }
  store.set(userId, updated)
  return updated
}

export function addAssertion(
  userId: string,
  assertion: Omit<UserAssertion, 'id' | 'extractedAt'>,
): PersonalContext {
  const ctx = getPersonalContext(userId)

  // Deduplicate by text similarity (exact match for now)
  const normalizedText = assertion.text.toLowerCase().trim()
  const duplicate = ctx.assertions.some(
    (a) => a.text.toLowerCase().trim() === normalizedText,
  )
  if (duplicate) return ctx

  const entry: UserAssertion = {
    ...assertion,
    id: randomUUID(),
    extractedAt: new Date().toISOString(),
  }

  const updated: PersonalContext = {
    ...ctx,
    assertions: [...ctx.assertions, entry],
    updatedAt: new Date().toISOString(),
  }
  store.set(userId, updated)
  return updated
}

export function decayCorrections(userId: string): PersonalContext {
  const ctx = getPersonalContext(userId)
  const now = Date.now()

  const decayed = ctx.corrections
    .map((c) => {
      const ageMs = now - new Date(c.createdAt).getTime()
      const ageDays = ageMs / (1000 * 60 * 60 * 24)
      const decayedConfidence = c.confidence - ageDays * CORRECTION_DECAY_PER_DAY
      return { ...c, confidence: Math.max(0, decayedConfidence) }
    })
    .filter((c) => c.confidence >= CORRECTION_MIN_CONFIDENCE)

  const updated: PersonalContext = {
    ...ctx,
    corrections: decayed,
    updatedAt: new Date().toISOString(),
  }
  store.set(userId, updated)
  return updated
}

function truncateToTokenBudget(text: string, budget: number): string {
  // Rough estimate: 1 token ≈ 4 chars
  const maxChars = budget * 4
  return text.length > maxChars ? text.slice(0, maxChars) + '...' : text
}

export function formatContextForPrompt(userId: string): string {
  const ctx = decayCorrections(userId)
  const sections: string[] = []

  // Corrections section
  const activeCorrections = ctx.corrections
    .filter((c) => c.confidence > 0.3)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_CORRECTIONS_IN_PROMPT)

  if (activeCorrections.length > 0) {
    const correctionLines = activeCorrections.map(
      (c) => `- At ${c.checkpointStage} for signal "${c.signalId}": changed "${c.originalValue}" → "${c.correctedValue}" (confidence: ${c.confidence.toFixed(1)})`,
    )
    sections.push(truncateToTokenBudget(
      `### Past Corrections\n${correctionLines.join('\n')}`,
      TOKEN_BUDGET_CORRECTIONS,
    ))
  }

  // Analysis memory section
  const recentMemory = ctx.analysisMemory.slice(-MAX_ANALYSIS_IN_PROMPT)
  if (recentMemory.length > 0) {
    const memoryLines = recentMemory.map((m) => {
      const holdingsStr = m.topHoldings
        .map((h) => `${h.ticker}: $${h.impactMid.toLocaleString()}`)
        .join(', ')
      return `- "${m.headline}" → ${m.verdictDirection}, 1M impact: $${m.oneMonthImpactMid.toLocaleString()}, action: ${m.userAction}, top: ${holdingsStr}`
    })
    sections.push(truncateToTokenBudget(
      `### Recent Analyses\n${memoryLines.join('\n')}`,
      TOKEN_BUDGET_ANALYSIS,
    ))
  }

  // Assertions section (grouped by category)
  if (ctx.assertions.length > 0) {
    const byCategory = new Map<string, string[]>()
    for (const a of ctx.assertions) {
      const existing = byCategory.get(a.category) ?? []
      byCategory.set(a.category, [...existing, a.text])
    }
    const assertionLines = [...byCategory.entries()]
      .map(([category, texts]) => `- **${category}**: ${texts.join('; ')}`)
    sections.push(truncateToTokenBudget(
      `### User Context & Preferences\n${assertionLines.join('\n')}`,
      TOKEN_BUDGET_ASSERTIONS,
    ))
  }

  if (sections.length === 0) return ''
  return `## PERSONAL CONTEXT\n\n${sections.join('\n\n')}`
}

// ── Watched Signal Helpers ───────────────────────────────────

export function addWatchedSignal(
  userId: string,
  signal: Pick<WatchedSignal, 'signalId' | 'headline' | 'originalSentiment' | 'originalRelevance' | 'originalSourceCount'>,
): PersonalContext {
  const ctx = getPersonalContext(userId)

  // Deduplicate by signalId
  if (ctx.watchedSignals.some((s) => s.signalId === signal.signalId)) {
    return ctx
  }

  const now = new Date().toISOString()
  const entry: WatchedSignal = {
    ...signal,
    watchedAt: now,
    lastCheckedAt: now,
  }

  const updated: PersonalContext = {
    ...ctx,
    watchedSignals: [...ctx.watchedSignals, entry],
    updatedAt: now,
  }
  store.set(userId, updated)
  return updated
}

export function removeWatchedSignal(userId: string, signalId: string): PersonalContext {
  const ctx = getPersonalContext(userId)
  const updated: PersonalContext = {
    ...ctx,
    watchedSignals: ctx.watchedSignals.filter((s) => s.signalId !== signalId),
    updatedAt: new Date().toISOString(),
  }
  store.set(userId, updated)
  return updated
}

export function getWatchedSignals(userId: string): readonly WatchedSignal[] {
  return getPersonalContext(userId).watchedSignals
}

export function updateWatchedSignalCheck(userId: string, signalId: string): PersonalContext {
  const ctx = getPersonalContext(userId)
  const now = new Date().toISOString()
  const updated: PersonalContext = {
    ...ctx,
    watchedSignals: ctx.watchedSignals.map((s) =>
      s.signalId === signalId ? { ...s, lastCheckedAt: now } : s,
    ),
    updatedAt: now,
  }
  store.set(userId, updated)
  return updated
}

// ── Recent Analysis Helpers ──────────────────────────────────

const DEFAULT_RECENT_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

export function hasRecentAnalysis(userId: string, withinMs: number = DEFAULT_RECENT_WINDOW_MS): boolean {
  const ctx = getPersonalContext(userId)
  if (ctx.analysisMemory.length === 0) return false

  const latest = ctx.analysisMemory[ctx.analysisMemory.length - 1]
  const ageMs = Date.now() - new Date(latest.completedAt).getTime()
  return ageMs < withinMs
}

export function getLatestAnalysisMemory(userId: string): AnalysisMemoryEntry | null {
  const ctx = getPersonalContext(userId)
  if (ctx.analysisMemory.length === 0) return null
  return ctx.analysisMemory[ctx.analysisMemory.length - 1]
}

// For testing: reset store
export function clearStore(): void {
  store.clear()
}
