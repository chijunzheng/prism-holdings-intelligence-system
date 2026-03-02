// Query Understanding Agent — unified LLM-based intent classification.
// Replaces both the ticker regex (false positives on common words like MY/ALL/THE)
// and the old LLM classifier (under-routes portfolio evaluation to chat).
// Single LLM call with explicit disambiguation rules.

import { HumanMessage } from '@langchain/core/messages'
import type { RouterIntent, Signal } from '@prism/shared'
import { createGeminiChatModel } from '../utils/gemini-chat-model'
import { getGeminiRouterModelName } from '../utils/env'

// ── Ambiguous Ticker Safety Net ──────────────────────────────
// Common English words that are also valid ticker symbols.
// Even if the LLM extracts one of these as a ticker, we reject it
// unless the user explicitly uppercased it (e.g., "explore MY" vs "evaluate my portfolio").

export const AMBIGUOUS_TICKER_WORDS = new Set([
  'MY', 'ALL', 'THE', 'IT', 'AT', 'BE', 'DO', 'GO', 'HE', 'IF',
  'IN', 'IS', 'ME', 'NO', 'OF', 'ON', 'OR', 'SO', 'TO', 'UP',
  'US', 'WE', 'AN', 'AM', 'AS', 'BY', 'FOR', 'HAS', 'HIM', 'HIS',
  'HOW', 'ITS', 'MAY', 'NEW', 'NOW', 'OLD', 'OUR', 'OUT', 'OWN',
  'RUN', 'SAY', 'SHE', 'TOO', 'TWO', 'WAY', 'WHO', 'BIG', 'CAN',
  'DAY', 'DID', 'GET', 'HAS', 'HER', 'LET', 'MAN', 'MEN', 'NOT',
  'ONE', 'PUT', 'SET', 'TEN', 'TOP', 'TRY', 'USE', 'WAS', 'WIN',
  'YOU', 'ARE', 'BUT', 'HAD', 'LOW', 'SEE', 'REAL', 'GOOD', 'WELL',
  'BEST', 'JUST', 'ALSO', 'VERY', 'BEEN', 'CALL', 'COME', 'EACH',
  'FAST', 'FIVE', 'FOUR', 'FROM', 'HAVE', 'HERE', 'HIGH', 'HOLD',
  'KNOW', 'LAST', 'LIKE', 'LONG', 'LOOK', 'MAKE', 'MANY', 'MUCH',
  'MUST', 'NEXT', 'ONLY', 'OPEN', 'OVER', 'PEAK', 'PLAN', 'PLAY',
  'SAFE', 'SAME', 'SOME', 'TAKE', 'TELL', 'THAT', 'THEM', 'THEN',
  'THIS', 'TRUE', 'TURN', 'WHAT', 'WHEN', 'WILL', 'WITH', 'WORK',
])

// ── JSON Extraction ──────────────────────────────────────────

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

// ── Intent Mapping ───────────────────────────────────────────

interface RawLlmIntent {
  readonly route: string
  readonly confidence?: number
  readonly reasoning?: string
  readonly pipelineMode?: string
  readonly matchedSignalId?: string
  readonly extractedTicker?: string
}

/**
 * Maps raw LLM output to a validated RouterIntent.
 * Rejects ambiguous ticker words (MY, ALL, THE, etc.) unless the user
 * explicitly typed the ticker in uppercase in the original message.
 */
export function mapToRouterIntent(
  raw: RawLlmIntent,
  originalMessage: string,
): RouterIntent {
  const route = (['chat', 'pipeline', 'portfolio_review'] as const).includes(
    raw.route as 'chat' | 'pipeline' | 'portfolio_review',
  )
    ? (raw.route as 'chat' | 'pipeline' | 'portfolio_review')
    : 'chat'

  const validModes = ['existing_signal', 'risk_check', 'improve_portfolio', 'explore_ticker', 'new_event'] as const
  const pipelineMode = route === 'pipeline' && raw.pipelineMode && validModes.includes(raw.pipelineMode as typeof validModes[number])
    ? (raw.pipelineMode as typeof validModes[number])
    : (route === 'pipeline' ? 'new_event' : undefined)

  // Ticker disambiguation: reject ambiguous words unless explicitly uppercased
  let extractedTicker = raw.extractedTicker?.toUpperCase()
  if (extractedTicker && AMBIGUOUS_TICKER_WORDS.has(extractedTicker)) {
    // Check if the user explicitly typed it in uppercase in the original message
    const tickerInMessage = originalMessage.includes(extractedTicker)
    if (!tickerInMessage) {
      // Ambiguous word used in natural language — not a ticker request
      extractedTicker = undefined
      // Downgrade from explore_ticker if that was the mode
      if (pipelineMode === 'explore_ticker') {
        return {
          route: 'chat',
          confidence: 0.7,
          reasoning: `Rejected ambiguous ticker "${raw.extractedTicker}" — likely natural language, not a ticker symbol`,
        }
      }
    }
  }

  return {
    route,
    confidence: Math.min(raw.confidence ?? 0.5, 1.0),
    reasoning: raw.reasoning ?? 'Query understanding classification',
    pipelineMode,
    matchedSignalId: raw.matchedSignalId,
    extractedTicker: pipelineMode === 'explore_ticker' ? extractedTicker : undefined,
  }
}

// ── Query Understanding Agent ────────────────────────────────

/**
 * Unified query understanding — replaces both the ticker regex and LLM classifier.
 * Single LLM call with explicit intent types, ticker disambiguation, and
 * portfolio evaluation routing.
 */
export async function understandQuery(params: {
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

  const prompt = `You are a routing classifier for Prism, a portfolio intelligence system.
Classify the user's message into one of three routes with specific intent.

## Routes

### "chat" — Conversational responses only
Use for: greetings, casual messages, follow-up questions about existing results, qualitative explanations, general finance education.

CRITICAL RULES:
1. Casual/vague messages ALWAYS route to chat. Examples: "what's up", "hey", "how's it going", "what's new", "yo", "sup", "hello". These are GREETINGS, not portfolio queries — even if the user has portfolio data.
2. If a recent analysis was just completed (hasRecentAnalysis=${hasRecentAnalysis}), follow-up questions about the results route to "chat" — NOT "pipeline". Only route to "pipeline" for EXPLICITLY NEW analysis requests.
3. Short ambiguous messages (under 5 words with no financial terms) default to "chat".
Examples of chat: "what's up", "how's it going", "can you explain the $653 impact?", "what timeline?", "tell me more about the bond impact"

### "pipeline" — Triggers quantitative analysis (NEW computation required)
Pipeline modes:
- "risk_check": User wants a comprehensive risk assessment of their CURRENT portfolio. Key phrases: "evaluate my portfolio", "what are my risks", "check my risk", "how risky is my portfolio", "assess my holdings", "review my current positions", "am I exposed to...".
- "improve_portfolio": User asks for optimization or improvement. Key phrases: "improve my portfolio", "optimize", "rebalance", "reduce risk", "better allocation", "how can I improve".
- "explore_ticker": User explicitly names a specific stock/ETF ticker to research. MUST extract a real ticker symbol. Key phrases: "explore AAPL", "look into TSLA", "what about adding NVDA", "research BRK.B".
- "existing_signal": User references a specific active signal for new analysis.
- "new_event": User describes a hypothetical scenario or new event for impact analysis.

### "portfolio_review" — Full portfolio review across ALL signals
Use only when user explicitly asks for a comprehensive review of ALL signals at once.

## Ticker Extraction Rules (CRITICAL)

When extracting a ticker for explore_ticker mode:
- ONLY extract explicitly named ticker symbols (1-5 uppercase letters, optionally with .XX suffix)
- Common English words that happen to be ticker symbols are NOT ticker requests when used naturally:
  BAD: "evaluate my portfolio" → DO NOT extract "MY" as a ticker
  BAD: "look at all my holdings" → DO NOT extract "ALL" as a ticker
  BAD: "what about the market" → DO NOT extract "THE" as a ticker
  GOOD: "explore AAPL" → extract "AAPL"
  GOOD: "look into VFV.TO" → extract "VFV.TO"
  GOOD: "what about adding NVDA" → extract "NVDA"
- The ticker must be the FOCUS of the query, not incidental text

## Active Signals
${signalList}

${historySnippet ? `## Recent Conversation\n${historySnippet}\n` : ''}${personalContextSummary ? `## User Context\n${personalContextSummary.slice(0, 150)}\n` : ''}
## Message
"${message}"

Respond with JSON only: {"route":"...","confidence":0.0-1.0,"reasoning":"...","pipelineMode":"...","matchedSignalId":"...","extractedTicker":"..."}`

  try {
    const response = await model.invoke([new HumanMessage(prompt)])
    const responseText = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
        : ''

    const parsed = JSON.parse(extractJson(responseText)) as RawLlmIntent
    return mapToRouterIntent(parsed, message)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'unknown'
    console.error('[QueryUnderstanding] LLM classification failed — falling back to chat:', errorMsg)
    return {
      route: 'chat',
      confidence: 0.3,
      reasoning: `Query understanding failed: ${errorMsg}`,
    }
  }
}
