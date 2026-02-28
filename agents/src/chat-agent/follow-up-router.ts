// Follow-Up Query Router — classifies user messages and routes them efficiently.
// Drill-downs use cached artifacts (<2s), what-ifs partially re-run pipeline (~8-12s),
// new signals trigger full pipeline.

import { HumanMessage } from '@langchain/core/messages'
import type {
  Signal,
  FundManagerVerdict,
  ResearchBrief,
  DebateResolution,
  StressTestResult,
  Portfolio,
  UserProfile,
  DollarRange,
} from '@prism/shared'
import { createGeminiChatModel } from '../utils/gemini-chat-model'

// ── Types ───────────────────────────────────────────────────

export type FollowUpType =
  | 'drill_down'
  | 'what_if_assumption'
  | 'what_if_portfolio'
  | 'comparison'
  | 'new_signal'
  | 'general'

export type FollowUpClassification = {
  readonly type: FollowUpType
  readonly confidence: number
  readonly modifiedAssumptions?: readonly string[]
  readonly targetSignalId?: string
  readonly targetHolding?: string
  readonly reasoning: string
}

export type FollowUpContext = {
  readonly signal: Signal
  readonly portfolioSummary: PortfolioSummary
  readonly verdictSummary: VerdictSummary
  readonly userProfile: UserProfile
  readonly researchBrief?: ResearchBrief
  readonly debateResolution?: DebateResolution
  readonly stressTestResult?: StressTestResult
  readonly otherVerdicts?: readonly VerdictSummary[]
  readonly recentMessages: readonly ChatMessage[]
}

export type PortfolioSummary = {
  readonly totalValueCad: number
  readonly holdingCount: number
  readonly topHoldings: readonly { ticker: string; name: string; valueCad: number; pct: number }[]
}

export type VerdictSummary = {
  readonly signalId: string
  readonly signalHeadline: string
  readonly impactRange: DollarRange
  readonly topImpacts: readonly { ticker: string; impact: DollarRange }[]
  readonly recommendationCount: number
  readonly qualityScore: number
}

type ChatMessage = {
  readonly role: 'user' | 'assistant'
  readonly content: string
}

// ── Pattern-Based Pre-Classification ────────────────────────

const DRILL_DOWN_PATTERNS = [
  /tell me more/i,
  /explain/i,
  /why does/i,
  /what about (the|my) (\w+) (impact|exposure|holding)/i,
  /show me the (details|breakdown|derivation)/i,
  /how (did|was) (the|this)/i,
  /what (are|were) the (assumptions|sources|evidence)/i,
  /expand on/i,
]

const WHAT_IF_ASSUMPTION_PATTERNS = [
  /what if .*(?:instead|rather|bps|basis points|percent|%|rate|hike|cut)/i,
  /what happens if .*(?:worse|better|different|changes?|cut|hike|rate|drop|rise)/i,
  /assume (?:that|instead)/i,
  /suppose/i,
  /if the (?:rate|price|market)/i,
]

const WHAT_IF_PORTFOLIO_PATTERNS = [
  /what if i (?:sold|bought|added|removed)/i,
  /if i (?:sell|buy|add|remove)/i,
  /without (my )?(\w+)/i,
  /if i (had|owned|held)/i,
]

const COMPARISON_PATTERNS = [
  /compare/i,
  /how does .*(?:compare|differ|vs|versus)/i,
  /(?:which|what) signal/i,
  /difference between/i,
]

const NEW_SIGNAL_PATTERNS = [
  /what about (?:the )?\w+ (?:announcement|news|report|event)/i,
  /have you (?:seen|heard|analyzed)/i,
  /new (?:signal|event|news)/i,
  /tariff|sanction|war|crisis|earnings/i,
]

export function classifyByPattern(message: string): FollowUpType | null {
  if (WHAT_IF_PORTFOLIO_PATTERNS.some((p) => p.test(message))) return 'what_if_portfolio'
  if (WHAT_IF_ASSUMPTION_PATTERNS.some((p) => p.test(message))) return 'what_if_assumption'
  if (COMPARISON_PATTERNS.some((p) => p.test(message))) return 'comparison'
  if (NEW_SIGNAL_PATTERNS.some((p) => p.test(message))) return 'new_signal'
  if (DRILL_DOWN_PATTERNS.some((p) => p.test(message))) return 'drill_down'
  return null
}

// ── LLM Classification (fallback) ───────────────────────────

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

async function classifyWithLlm(
  message: string,
  activeSignals: readonly Signal[],
): Promise<FollowUpClassification> {
  const model = createGeminiChatModel({
    model: 'gemini-2.5-flash',
    temperature: 0,
    maxOutputTokens: 512,
  })

  const signalList = activeSignals
    .map((s) => `- ${s.id}: "${s.headline}"`)
    .join('\n')

  const prompt = `Classify the following user message into one of these types:
- drill_down: User wants more details about an existing analysis (impact, assumptions, sources)
- what_if_assumption: User wants to change an assumption (different rate, different scenario)
- what_if_portfolio: User wants to explore a portfolio change (sell, buy, add, remove holdings)
- comparison: User wants to compare two signals or holdings
- new_signal: User is asking about an unanalyzed event or news
- general: General question or conversation

Active signals:
${signalList || 'None'}

User message: "${message}"

Respond with JSON:
{"type": "...", "confidence": 0.0-1.0, "reasoning": "..."}
Only include "modifiedAssumptions", "targetSignalId", or "targetHolding" if relevant.`

  const response = await model.invoke([new HumanMessage(prompt)])
  const responseText = typeof response.content === 'string'
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
      : ''

  try {
    const parsed = JSON.parse(extractJson(responseText))
    return {
      type: parsed.type ?? 'general',
      confidence: parsed.confidence ?? 0.5,
      modifiedAssumptions: parsed.modifiedAssumptions,
      targetSignalId: parsed.targetSignalId,
      targetHolding: parsed.targetHolding,
      reasoning: parsed.reasoning ?? '',
    }
  } catch {
    return { type: 'general', confidence: 0.3, reasoning: 'Failed to parse LLM classification' }
  }
}

// ── Main Classification ─────────────────────────────────────

export async function classifyFollowUp(params: {
  readonly message: string
  readonly activeSignals: readonly Signal[]
}): Promise<FollowUpClassification> {
  const { message, activeSignals } = params

  // Try pattern-based first (fast, no LLM cost)
  const patternType = classifyByPattern(message)
  if (patternType) {
    return {
      type: patternType,
      confidence: 0.85,
      reasoning: `Matched pattern for ${patternType}`,
    }
  }

  // Fall back to LLM classification
  return classifyWithLlm(message, activeSignals)
}

// ── Context Builders ────────────────────────────────────────

export function buildPortfolioSummary(portfolio: Portfolio): PortfolioSummary {
  const allHoldings = portfolio.accounts.flatMap((a) => a.holdings)
  const totalValueCad = allHoldings.reduce((sum, h) => sum + h.valueCad, 0)

  const sorted = [...allHoldings].sort((a, b) => b.valueCad - a.valueCad)
  const topHoldings = sorted.slice(0, 5).map((h) => ({
    ticker: h.ticker,
    name: h.name,
    valueCad: h.valueCad,
    pct: Math.round((h.valueCad / totalValueCad) * 100),
  }))

  return { totalValueCad, holdingCount: allHoldings.length, topHoldings }
}

export function buildVerdictSummary(
  verdict: FundManagerVerdict,
  signal: Signal,
): VerdictSummary {
  const impacts1M = verdict.holdingImpacts
    .map((h) => ({
      ticker: h.ticker,
      impact: h.impact['1M'] ?? { low: 0, mid: 0, high: 0 },
    }))
    .sort((a, b) => Math.abs(b.impact.mid) - Math.abs(a.impact.mid))

  const impactRange: DollarRange = {
    low: impacts1M.reduce((sum, i) => sum + i.impact.low, 0),
    mid: impacts1M.reduce((sum, i) => sum + i.impact.mid, 0),
    high: impacts1M.reduce((sum, i) => sum + i.impact.high, 0),
  }

  return {
    signalId: signal.id,
    signalHeadline: signal.headline,
    impactRange,
    topImpacts: impacts1M.slice(0, 3),
    recommendationCount: verdict.recommendations.length,
    qualityScore: verdict.qualityScore,
  }
}

export function buildFollowUpContext(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly userProfile: UserProfile
  readonly verdict: FundManagerVerdict
  readonly researchBrief?: ResearchBrief
  readonly debateResolution?: DebateResolution
  readonly stressTestResult?: StressTestResult
  readonly otherVerdicts?: readonly { signal: Signal; verdict: FundManagerVerdict }[]
  readonly recentMessages?: readonly ChatMessage[]
}): FollowUpContext {
  const {
    signal,
    portfolio,
    userProfile,
    verdict,
    researchBrief,
    debateResolution,
    stressTestResult,
    otherVerdicts,
    recentMessages = [],
  } = params

  return {
    signal,
    portfolioSummary: buildPortfolioSummary(portfolio),
    verdictSummary: buildVerdictSummary(verdict, signal),
    userProfile,
    researchBrief,
    debateResolution,
    stressTestResult,
    otherVerdicts: otherVerdicts?.map((ov) => buildVerdictSummary(ov.verdict, ov.signal)),
    recentMessages: recentMessages.slice(-10), // Last 10 messages
  }
}
