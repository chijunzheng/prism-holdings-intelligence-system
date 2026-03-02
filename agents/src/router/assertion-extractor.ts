// Background assertion extraction from user chat messages.
// Runs async after response is sent — never adds latency.
// Only fires for messages > 20 chars.

import { HumanMessage } from '@langchain/core/messages'
import type { UserAssertion, AssertionCategory } from '@prism/shared'
import { createGeminiChatModel } from '../utils/gemini-chat-model'
import { randomUUID } from 'crypto'

const MIN_MESSAGE_LENGTH = 20

const VALID_CATEGORIES: readonly AssertionCategory[] = [
  'risk_preference',
  'time_horizon',
  'life_event',
  'sector_preference',
  'constraint',
  'goal',
  'other',
]

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

export async function extractAssertions(
  message: string,
  sourceMessageId?: string,
): Promise<readonly UserAssertion[]> {
  if (message.trim().length < MIN_MESSAGE_LENGTH) return []

  try {
    const model = createGeminiChatModel({
      model: 'gemini-2.5-flash',
      temperature: 0,
      maxOutputTokens: 256,
    })

    const prompt = `Extract any personal financial assertions from this user message. An assertion is a statement about the user's:
- risk_preference: risk tolerance, comfort with volatility
- time_horizon: investment timeline, retirement date
- life_event: major purchases, job changes, family events
- sector_preference: preferred/avoided sectors or asset classes
- constraint: tax constraints, liquidity needs, ethical restrictions
- goal: financial goals, target amounts
- other: any other relevant personal context

Only extract CLEAR assertions — not questions or hypotheticals.

User message: "${message}"

Respond with a JSON array (empty if no assertions found):
[{"text": "concise assertion", "category": "...", "confidence": 0.0-1.0}]`

    const response = await model.invoke([new HumanMessage(prompt)])
    const responseText = typeof response.content === 'string'
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
        : ''

    const parsed = JSON.parse(extractJson(responseText))

    if (!Array.isArray(parsed)) return []

    const now = new Date().toISOString()
    return parsed
      .filter((item: { text?: string; category?: string; confidence?: number }) =>
        item.text &&
        item.category &&
        VALID_CATEGORIES.includes(item.category as AssertionCategory),
      )
      .map((item: { text: string; category: AssertionCategory; confidence?: number }) => ({
        id: randomUUID(),
        text: item.text,
        category: item.category,
        extractedAt: now,
        sourceMessageId,
        confidence: item.confidence ?? 0.8,
      }))
  } catch {
    // Assertion extraction is best-effort — never block
    return []
  }
}
