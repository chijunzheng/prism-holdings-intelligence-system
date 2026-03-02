// Bull Researcher — builds the strongest case FOR the analyst consensus.
// Round 1: Synthesizes all 4 analyst views into a coherent thesis.
// Subsequent rounds: Responds to Bear's counterarguments with evidence.

import { HumanMessage } from '@langchain/core/messages'
import {
  DebateArgumentSchema,
  type DebateArgument,
  type AnalystAssessment,
  type Signal,
  type ExposureMap,
} from '@prism/shared'
import { createGeminiChatModel } from '../../utils/gemini-chat-model'

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
}

function extractResponseText(content: unknown): string {
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk !== 'object' || chunk === null || !('text' in chunk)) return ''
        const text = (chunk as { readonly text?: unknown }).text
        return typeof text === 'string' ? text : ''
      })
      .join('')
  }

  return ''
}

type DebateParseOutcome =
  | { readonly kind: 'ok', readonly data: DebateArgument }
  | { readonly kind: 'parse_error', readonly snippet: string }
  | { readonly kind: 'validation_error', readonly message: string }

function parseDebateArgument(responseText: string): DebateParseOutcome {
  const jsonStr = extractJson(responseText)
  let parsed: unknown

  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return { kind: 'parse_error', snippet: jsonStr.slice(0, 300) }
  }

  const result = DebateArgumentSchema.safeParse(parsed)
  if (!result.success) {
    return { kind: 'validation_error', message: result.error.message }
  }

  return { kind: 'ok', data: result.data }
}

function buildRetryPrompt(originalPrompt: string, failure: DebateParseOutcome): string {
  let issue = 'Unknown failure'
  if (failure.kind === 'parse_error') issue = `JSON parsing failed:\n${failure.snippet}`
  if (failure.kind === 'validation_error') issue = `Schema validation failed:\n${failure.message}`

  return [
    'Your previous response could not be accepted.',
    issue,
    'Respond with ONLY valid JSON. No markdown, no code fences, no commentary.',
    '',
    `Original task:\n${originalPrompt}`,
  ].join('\n')
}

function fallbackBullArgument(round: number, reason: string): DebateArgument {
  return {
    position: 'mixed',
    round,
    keyPoints: ['Bull argument fallback used due to JSON parsing/validation failure.'],
    evidenceCited: ['fallback://bull-researcher-unavailable'],
    rebuttalPoints: ['Unable to generate full rebuttal in this round.'],
    concessions: [],
  }
}

function formatAnalystSummaries(assessments: readonly AnalystAssessment[]): string {
  return assessments
    .map((a) => [
      `${a.analystType.toUpperCase()}: ${a.overallDirection} (confidence: ${a.overallConfidence.toFixed(2)})`,
      `  Reasoning: ${a.reasoning}`,
      `  Key assumptions: ${a.keyAssumptions.join('; ')}`,
      `  Evidence: ${a.evidenceSources.join('; ')}`,
    ].join('\n'))
    .join('\n\n')
}

function buildBullPrompt(params: {
  readonly round: number
  readonly analystAssessments: readonly AnalystAssessment[]
  readonly signal: Signal
  readonly exposureMap: ExposureMap
  readonly bearArgument?: DebateArgument
  readonly ownPriorArgument?: DebateArgument
  readonly humanCorrection?: string
}): string {
  const { round, analystAssessments, signal, bearArgument, ownPriorArgument, humanCorrection } = params

  const sections = [
    'You are the BULL researcher in a structured financial debate.',
    `This is Round ${round} of the debate.`,
    '',
    `SIGNAL: ${signal.headline}`,
    `Description: ${signal.description}`,
    '',
    '--- ANALYST ASSESSMENTS ---',
    formatAnalystSummaries(analystAssessments),
  ]

  if (humanCorrection) {
    sections.push(
      '',
      '--- USER CORRECTION ---',
      `The user has provided this correction: "${humanCorrection}"`,
      'Factor this into your analysis. This correction takes priority.',
    )
  }

  if (round === 1) {
    sections.push(
      '',
      '--- YOUR TASK (Round 1) ---',
      'Synthesize all 4 analyst perspectives into the STRONGEST case for how this signal',
      'impacts the portfolio. Identify the strongest supporting evidence and the most',
      'agreed-upon transmission channels.',
      'Build a coherent thesis that explains why this signal matters.',
    )
  } else {
    sections.push(
      '',
      '--- BEAR\'S ARGUMENT ---',
      bearArgument ? JSON.stringify(bearArgument, null, 2) : '(none)',
      '',
      '--- YOUR PRIOR ARGUMENT ---',
      ownPriorArgument ? JSON.stringify(ownPriorArgument, null, 2) : '(none)',
      '',
      `--- YOUR TASK (Round ${round}) ---`,
      'Defend your thesis against the Bear\'s counterarguments.',
      'Address EACH of the Bear\'s key points with specific evidence.',
      'Concede points where the Bear has valid evidence — do not be stubborn.',
      'Add concessions to the "concessions" array where the Bear made valid points.',
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

export async function runBullResearcher(params: {
  readonly round: number
  readonly analystAssessments: readonly AnalystAssessment[]
  readonly signal: Signal
  readonly exposureMap: ExposureMap
  readonly bearArgument?: DebateArgument
  readonly ownPriorArgument?: DebateArgument
  readonly humanCorrection?: string
}): Promise<DebateArgument> {
  const model = createGeminiChatModel({
    model: 'gemini-3-flash-preview',
    temperature: 0.4,
    maxOutputTokens: 3072,
    json: true,
  })

  const prompt = buildBullPrompt(params)
  let workingPrompt = prompt
  let lastFailure: DebateParseOutcome | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await model.invoke([new HumanMessage(workingPrompt)])
    const parsed = parseDebateArgument(extractResponseText(response.content))
    if (parsed.kind === 'ok') return parsed.data

    lastFailure = parsed
    if (attempt === 0) {
      workingPrompt = buildRetryPrompt(prompt, parsed)
    }
  }

  const reason =
    lastFailure?.kind === 'parse_error'
      ? lastFailure.snippet
      : lastFailure?.kind === 'validation_error'
        ? lastFailure.message
        : 'unknown failure'

  return fallbackBullArgument(params.round, reason)
}
