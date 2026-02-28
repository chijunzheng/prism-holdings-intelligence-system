// Bear Researcher — challenges the analyst consensus.
// Finds flaws, missing risks, over-confidence, historical counterexamples.
// MUST introduce NEW evidence each round — cannot repeat prior arguments.

import { HumanMessage } from '@langchain/core/messages'
import {
  DebateArgumentSchema,
  type DebateArgument,
  type AnalystAssessment,
  type Signal,
} from '@prism/shared'
import { createGeminiChatModel } from '../../utils/gemini-chat-model'

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

function buildBearPrompt(params: {
  readonly round: number
  readonly analystAssessments: readonly AnalystAssessment[]
  readonly signal: Signal
  readonly bullArgument: DebateArgument
  readonly ownPriorArgument?: DebateArgument
}): string {
  const { round, analystAssessments, signal, bullArgument, ownPriorArgument } = params

  const weakAssumptions = analystAssessments
    .flatMap((a) => a.keyAssumptions.map((k) => `[${a.analystType}] ${k}`))
    .join('\n  ')

  const sections = [
    'You are the BEAR researcher in a structured financial debate.',
    'Your job is to CHALLENGE the consensus and find what the analysts got wrong.',
    `This is Round ${round} of the debate.`,
    '',
    `SIGNAL: ${signal.headline}`,
    '',
    '--- BULL\'S ARGUMENT ---',
    JSON.stringify(bullArgument, null, 2),
    '',
    '--- ANALYST ASSUMPTIONS TO CHALLENGE ---',
    `  ${weakAssumptions}`,
  ]

  if (round === 1) {
    sections.push(
      '',
      '--- YOUR TASK (Round 1) ---',
      'Challenge the Bull\'s thesis. Find the WEAKEST assumptions across all 4 analysts.',
      'Search for counter-evidence. Argue for a SMALLER or DIFFERENT impact.',
      'Be specific — cite historical counterexamples, alternative interpretations, or data.',
    )
  } else {
    sections.push(
      '',
      '--- YOUR PRIOR ARGUMENT ---',
      ownPriorArgument ? JSON.stringify(ownPriorArgument, null, 2) : '(none)',
      '',
      `--- YOUR TASK (Round ${round}) ---`,
      'Rebut the Bull\'s latest defense.',
      'CRITICAL: You MUST introduce at least ONE piece of NEW evidence.',
      'Do NOT repeat arguments from your prior rounds.',
      'Concede points where the Bull has valid evidence — add to "concessions" array.',
    )
  }

  sections.push(`
Respond with valid JSON:
{
  "position": "positive" | "negative" | "neutral" | "mixed",
  "round": ${round},
  "keyPoints": ["string", ...],
  "evidenceCited": ["string", ...],
  "rebuttalPoints": ["string", ...],
  "concessions": ["string", ...]
}`)

  return sections.join('\n')
}

export async function runBearResearcher(params: {
  readonly round: number
  readonly analystAssessments: readonly AnalystAssessment[]
  readonly signal: Signal
  readonly bullArgument: DebateArgument
  readonly ownPriorArgument?: DebateArgument
}): Promise<DebateArgument> {
  const model = createGeminiChatModel({
    model: 'gemini-2.5-flash',
    temperature: 0.5, // Slightly higher for creative counter-arguments
    maxOutputTokens: 3072,
  })

  const prompt = buildBearPrompt(params)
  const response = await model.invoke([new HumanMessage(prompt)])
  const responseText = typeof response.content === 'string'
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
      : ''

  const jsonStr = extractJson(responseText)
  const parsed = JSON.parse(jsonStr)
  const result = DebateArgumentSchema.safeParse(parsed)

  if (result.success) {
    return result.data
  }

  // Retry once
  const retryPrompt = `Validation errors:\n${result.error.message}\n\nFix and respond with valid JSON. Task:\n${prompt}`
  const retryResponse = await model.invoke([new HumanMessage(retryPrompt)])
  const retryText = typeof retryResponse.content === 'string'
    ? retryResponse.content
    : Array.isArray(retryResponse.content)
      ? retryResponse.content.map((c) => ('text' in c ? c.text : '')).join('')
      : ''

  return DebateArgumentSchema.parse(JSON.parse(extractJson(retryText)))
}
