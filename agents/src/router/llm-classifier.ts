// LLM-based classification fallback for the router agent.
// Uses Gemini Flash for ~300ms classification of ambiguous messages.

import { HumanMessage } from '@langchain/core/messages'
import type { RouterIntent, Signal } from '@prism/shared'
import { createGeminiChatModel } from '../utils/gemini-chat-model'
import { getGeminiFastModelName } from '../utils/env'

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

export async function classifyWithLlm(params: {
  readonly message: string
  readonly activeSignals: readonly Signal[]
  readonly recentMessages?: readonly { role: string; content: string }[]
  readonly personalContextSummary?: string
}): Promise<RouterIntent> {
  const { message, activeSignals, recentMessages, personalContextSummary } = params

  const model = createGeminiChatModel({
    model: getGeminiFastModelName(),
    temperature: 0,
    maxOutputTokens: 256,
  })

  // Limit to top 3 signals to reduce input tokens
  const topSignals = activeSignals.slice(0, 3)
  const signalList = topSignals.length > 0
    ? topSignals.map((s) => `- "${s.headline}" (id: ${s.id})`).join('\n')
    : 'None active'

  const historySnippet = recentMessages
    ? recentMessages.slice(-3).map((m) => `${m.role}: ${m.content.slice(0, 80)}`).join('\n')
    : ''

  const prompt = `Routing classifier for Prism portfolio intelligence. Route user messages to: chat, pipeline, or portfolio_review.

RULE: Dollar amounts, costs, financial impact, quantitative risk → pipeline. Chat agent cannot produce dollar estimates.

Routes:
- chat: General questions, explanations, greetings, qualitative topics
- pipeline: Quantitative analysis, dollar impact, risk assessment, optimization, ticker exploration, what-if with numbers
- portfolio_review: Full portfolio review across all signals

Pipeline modes: existing_signal, risk_check, improve_portfolio, explore_ticker, new_event

Signals: ${signalList}
${historySnippet ? `History: ${historySnippet}\n` : ''}${personalContextSummary ? `Context: ${personalContextSummary.slice(0, 150)}\n` : ''}
Message: "${message}"

JSON only: {"route":"...","confidence":0.0-1.0,"reasoning":"...","pipelineMode":"...","matchedSignalId":"...","extractedTicker":"..."}`

  try {
    const response = await model.invoke([new HumanMessage(prompt)])
    const responseText = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
        : ''

    const parsed = JSON.parse(extractJson(responseText))

    return {
      route: parsed.route ?? 'chat',
      confidence: Math.min(parsed.confidence ?? 0.5, 0.8), // Cap LLM confidence below pattern confidence
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
