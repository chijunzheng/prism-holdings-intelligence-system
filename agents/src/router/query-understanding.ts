// Query Understanding Agent — unified LLM-based intent classification.
// Replaces both the ticker regex (false positives on common words like MY/ALL/THE)
// and the old LLM classifier (under-routes portfolio evaluation to chat).
// Single LLM call with explicit disambiguation rules.

import { HumanMessage } from '@langchain/core/messages'
import type { RouterIntent, Signal } from '@prism/shared'
import { createGeminiChatModel } from '../utils/gemini-chat-model'
import { getGeminiRouterModelName } from '../utils/env'
import { repairJson } from '../utils/json-parse.js'

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

// ── JSON Extraction & Repair ─────────────────────────────────

function extractJson(text: string): string {
  // Try standard markdown code fence first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  // Strip leading/trailing code fences if closing ``` was cut off or regex missed
  const stripped = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '').trim()
  if (stripped !== text.trim() && stripped.startsWith('{')) return stripped
  // Fall back to extracting the first JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

/** Attempt to repair truncated JSON from token-limited LLM responses. */
function repairTruncatedJson(text: string): string {
  let repaired = text.trim()
  // Close unterminated strings: find last unmatched quote
  const quoteCount = (repaired.match(/(?<!\\)"/g) ?? []).length
  if (quoteCount % 2 !== 0) {
    repaired += '"'
  }
  // Balance braces
  const openBraces = (repaired.match(/\{/g) ?? []).length
  const closeBraces = (repaired.match(/\}/g) ?? []).length
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}'
  }
  return repaired
}

// ── Intent Mapping ───────────────────────────────────────────

interface RawLlmIntent {
  readonly route: string
  readonly confidence?: number
  readonly reasoning?: string
  readonly pipelineMode?: string
  readonly matchedSignalId?: string
  readonly extractedTicker?: string
  readonly introText?: string
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
    introText: route !== 'chat' ? raw.introText : undefined,
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
    maxOutputTokens: 512,
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
Use for: greetings, casual messages, follow-up questions about existing results, qualitative explanations, general finance education, and LISTING/OVERVIEW queries.

CRITICAL RULES:
1. Casual/vague messages ALWAYS route to chat. Examples: "what's up", "hey", "how's it going", "what's new", "yo", "sup", "hello". These are GREETINGS, not portfolio queries — even if the user has portfolio data.
2. If a recent analysis was just completed (hasRecentAnalysis=${hasRecentAnalysis}), follow-up questions about the results route to "chat" — NOT "pipeline". Follow-ups are questions that reference or ask about EXISTING results (e.g., "explain the $653 impact", "what timeline?", "tell me more").
3. Short ambiguous messages (under 5 words with no financial terms) default to "chat".
4. Questions that ask to LIST or SUMMARIZE detected signals, risks, or portfolio status route to "chat" — they do NOT require new computation. The chat agent already has access to active signals and portfolio data. Examples: "what signals are affecting my portfolio", "what risks do I have right now", "show me my active signals", "what's going on with my portfolio", "any signals I should know about", "what's happening in the market for me".
Examples of chat: "what's up", "how's it going", "can you explain the $653 impact?", "what timeline?", "tell me more about the bond impact", "what signals are affecting me", "show me my risks", "what's happening with my portfolio"

### "pipeline" — Triggers quantitative analysis (NEW computation required)
ALWAYS route to pipeline when the user requests any of the following, regardless of hasRecentAnalysis:
- Risk assessment, portfolio evaluation, portfolio improvement, optimization, rebalancing, scenario analysis, signal analysis, or ticker exploration.
These are NOT follow-ups — they require new multi-agent computation.

Pipeline modes:
- "risk_check": User wants a comprehensive QUANTITATIVE risk assessment — deep analysis with dollar-impact estimates. Key phrases: "evaluate my portfolio risk", "run a risk assessment", "check my risk exposure", "how risky is my portfolio", "assess my holdings in detail", "stress test my portfolio", "how much could I lose". NOTE: Simple listing questions ("what signals do I have", "what's affecting my portfolio") go to "chat", not here — risk_check is for deep computational analysis only.
- "improve_portfolio": User asks for optimization or improvement. Key phrases: "improve my portfolio", "optimize", "rebalance", "reduce risk", "better allocation", "how can I improve", "ways to improve", "strengthen my portfolio".
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

## Intro Text (REQUIRED when route is "pipeline" or "portfolio_review")
When routing to pipeline or portfolio_review, generate a brief conversational "introText" (1-2 sentences) that:
- Acknowledges the user's specific question/concern (reference their actual topic, not generic text)
- Briefly says what Prism will do (e.g., "run the numbers", "pull in real market data", "check across all your signals")
- Sounds like a knowledgeable friend, not a robot
- Is UNIQUE to this query — never repeat the same intro twice
Examples:
- "Good call — let me dig into how that rate hike could hit your bank holdings. I'll pull real volatility data and run it through multiple analysts."
- "On it — let me stress-test your portfolio against that oil price drop and see where you're actually exposed."
- "Sure thing — I'll look across all your active signals and calculate the net effect on your holdings."
Do NOT include introText for "chat" route.

Respond with JSON only (keep reasoning under 30 words): {"route":"...","confidence":0.0-1.0,"reasoning":"...","pipelineMode":"...","matchedSignalId":"...","extractedTicker":"...","introText":"..."}`

  try {
    const response = await model.invoke([new HumanMessage(prompt)])
    const responseText = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
        : ''

    const jsonText = extractJson(responseText)
    let parsed: RawLlmIntent
    try {
      parsed = JSON.parse(jsonText) as RawLlmIntent
    } catch {
      // Try LLM JSON repair (single quotes, trailing commas, unquoted keys)
      try {
        parsed = JSON.parse(repairJson(jsonText)) as RawLlmIntent
      } catch {
        // Last resort: fix truncated JSON (unterminated strings, unbalanced braces)
        parsed = JSON.parse(repairTruncatedJson(repairJson(jsonText))) as RawLlmIntent
      }
    }
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
