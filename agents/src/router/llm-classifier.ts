// LLM-based classification — primary classifier for the router agent.
// Uses Gemini Flash Lite for ~200ms follow-up-aware classification.

import { HumanMessage } from '@langchain/core/messages'
import type { RouterIntent, Signal } from '@prism/shared'
import { createGeminiChatModel } from '../utils/gemini-chat-model'
import { getGeminiRouterModelName } from '../utils/env'
import { parseJsonSafe } from '../utils/json-parse.js'

/**
 * @deprecated Use `understandQuery()` from `./query-understanding.ts` instead.
 * This classifier under-routes portfolio evaluation queries to chat and lacks
 * ticker disambiguation. Kept for backward compatibility only.
 */
export async function classifyRoute(params: {
  readonly message: string
  readonly recentMessages?: readonly { role: string; content: string }[]
  readonly personalContextSummary?: string
  readonly hasRecentAnalysis: boolean
  readonly activeSignals?: readonly Signal[]
}): Promise<RouterIntent> {
  const { message, recentMessages, personalContextSummary, hasRecentAnalysis, activeSignals } = params

  const model = createGeminiChatModel({
    model: getGeminiRouterModelName(),
    temperature: 0,
    maxOutputTokens: 256,
  })

  const topSignals = (activeSignals ?? []).slice(0, 3)
  const signalList = topSignals.length > 0
    ? topSignals.map((s) => `- "${s.headline}" (id: ${s.id})`).join('\n')
    : 'None active'

  const historySnippet = recentMessages
    ? recentMessages.slice(-4).map((m) => `${m.role}: ${m.content.slice(0, 100)}`).join('\n')
    : ''

  const prompt = `You are a routing classifier for Prism, a portfolio intelligence system. Classify the user's message into one of three routes.

CRITICAL RULES:
1. If a recent analysis was just completed (hasRecentAnalysis=${hasRecentAnalysis}), follow-up questions about the results (timeline, details, explanation, clarification) route to "chat" — NOT "pipeline". Only route to "pipeline" for EXPLICITLY NEW analysis requests (e.g., "analyze the oil situation", "run a risk check", "what would happen if rates drop 50bps").
2. Dollar amounts, costs, financial impact questions → "pipeline" ONLY if asking for a NEW computation. Asking "can you explain the $653 impact?" after an analysis is "chat".
3. Questions that reference the previous analysis in any way (e.g., "what timeline?", "how does that affect me?", "tell me more about the bond impact") → "chat".

Routes:
- "chat": General questions, explanations, greetings, follow-ups about existing results, qualitative topics
- "pipeline": NEW quantitative analysis, NEW dollar impact computation, risk assessment, optimization, ticker exploration, what-if with numbers that hasn't been run yet
- "portfolio_review": Explicit full portfolio review across ALL signals

Pipeline modes (only if route=pipeline):
- "existing_signal": User references a specific active signal for new analysis
- "risk_check": User asks for comprehensive risk check
- "improve_portfolio": User asks for optimization/improvement suggestions
- "explore_ticker": User wants to explore adding a specific ticker
- "new_event": User describes a new event/scenario for impact analysis

Active signals:
${signalList}

${historySnippet ? `Recent conversation:\n${historySnippet}\n` : ''}${personalContextSummary ? `User context: ${personalContextSummary.slice(0, 150)}\n` : ''}
Message: "${message}"

Respond with JSON only: {"route":"...","confidence":0.0-1.0,"reasoning":"...","pipelineMode":"...","matchedSignalId":"...","extractedTicker":"..."}`

  try {
    const response = await model.invoke([new HumanMessage(prompt)])
    const responseText = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
        : ''

    const parsed = parseJsonSafe(responseText)

    return {
      route: parsed.route ?? 'chat',
      confidence: Math.min(parsed.confidence ?? 0.5, 1.0),
      reasoning: parsed.reasoning ?? 'LLM classification',
      pipelineMode: parsed.pipelineMode,
      matchedSignalId: parsed.matchedSignalId,
      extractedTicker: parsed.extractedTicker,
    }
  } catch (error) {
    // Fallback to chat on any error
    return {
      route: 'chat',
      confidence: 0.3,
      reasoning: `LLM classification failed: ${error instanceof Error ? error.message : 'unknown'}`,
    }
  }
}

/**
 * @deprecated Use classifyRoute() instead. Kept for backward compatibility.
 */
export async function classifyWithLlm(params: {
  readonly message: string
  readonly activeSignals: readonly Signal[]
  readonly recentMessages?: readonly { role: string; content: string }[]
  readonly personalContextSummary?: string
}): Promise<RouterIntent> {
  return classifyRoute({
    ...params,
    hasRecentAnalysis: false,
  })
}
