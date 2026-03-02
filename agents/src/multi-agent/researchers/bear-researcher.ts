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
import { parseJsonSafe } from '../../utils/json-parse.js'

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
  let parsed: unknown

  try {
    parsed = parseJsonSafe(responseText)
  } catch {
    return { kind: 'parse_error', snippet: responseText.slice(0, 300) }
  }

  const result = DebateArgumentSchema.safeParse(parsed)
  if (!result.success) {
    return { kind: 'validation_error', message: result.error.message }
  }

  return { kind: 'ok', data: result.data }
}

const JSON_SCHEMA_INSTRUCTION = `You MUST respond with a JSON object matching this EXACT schema. No markdown, no code fences, no commentary — ONLY valid JSON:
{
  "position": "positive" | "negative" | "neutral" | "mixed",
  "round": <number>,
  "keyPoints": ["string", ...],
  "evidenceCited": ["string", ...],
  "rebuttalPoints": ["string", ...],
  "concessions": ["string", ...]
}`

function buildRetryPrompt(round: number, signal: string, task: string, failure: DebateParseOutcome): string {
  const issue = failure.kind === 'parse_error'
    ? `JSON parsing failed. Fragment: ${failure.snippet}`
    : failure.kind === 'validation_error'
      ? `Schema validation failed: ${failure.message}`
      : 'Unknown failure'

  return [
    JSON_SCHEMA_INSTRUCTION,
    '',
    `Previous attempt failed: ${issue}`,
    '',
    `You are the BEAR researcher, Round ${round}. Signal: "${signal}".`,
    task,
    'Respond with ONLY the JSON object above.',
  ].join('\n')
}

function fallbackBearArgument(round: number, reason: string): DebateArgument {
  return {
    position: 'mixed',
    round,
    keyPoints: ['Bear argument fallback used due to JSON parsing/validation failure.'],
    evidenceCited: ['fallback://bear-researcher-unavailable'],
    rebuttalPoints: ['Unable to generate full rebuttal in this round.'],
    concessions: [],
  }
}

function buildBearPrompt(params: {
  readonly round: number
  readonly analystAssessments: readonly AnalystAssessment[]
  readonly signal: Signal
  readonly bullArgument?: DebateArgument
  readonly ownPriorArgument?: DebateArgument
  readonly mode?: 'independent' | 'responsive'
  readonly humanCorrection?: string
}): string {
  const { round, analystAssessments, signal, bullArgument, ownPriorArgument, mode, humanCorrection } = params

  const weakAssumptions = analystAssessments
    .flatMap((a) => a.keyAssumptions.map((k) => `[${a.analystType}] ${k}`))
    .join('\n  ')

  // Research brief injection helper
  const briefSections: string[] = []
  const brief = signal.researchBrief
  if (brief) {
    briefSections.push(
      '',
      '--- RESEARCH BRIEF (shared context) ---',
      `Key Facts: ${brief.keyFacts.join('; ')}`,
      `Causal Mechanism: ${brief.causalMechanism}`,
      ...(brief.knownUnknowns.length > 0 ? [`Known Unknowns: ${brief.knownUnknowns.join('; ')}`] : []),
      'Find evidence that CONTRADICTS or complicates this analysis.',
    )
  }

  // Independent mode for Round 1: challenge analyst consensus directly (no Bull argument)
  if (mode === 'independent' || (round === 1 && !bullArgument)) {
    return [
      JSON_SCHEMA_INSTRUCTION,
      '',
      'You are the BEAR researcher in a structured financial debate.',
      'Your job is to CHALLENGE the analyst consensus and find what they got wrong.',
      `This is Round ${round} of the debate.`,
      '',
      `SIGNAL: ${signal.headline}`,
      ...briefSections,
      '',
      '--- ANALYST ASSESSMENTS TO CHALLENGE ---',
      JSON.stringify(analystAssessments.map((a) => ({
        type: a.analystType,
        direction: a.overallDirection,
        confidence: a.overallConfidence,
        reasoning: a.reasoning,
        assumptions: a.keyAssumptions,
      })), null, 2),
      '',
      '--- ANALYST ASSUMPTIONS TO CHALLENGE ---',
      `  ${weakAssumptions}`,
      '',
      ...(humanCorrection ? [
        '--- USER CORRECTION ---',
        `The user has provided this correction: "${humanCorrection}"`,
        'Factor this into your analysis. This correction takes priority.',
        '',
      ] : []),
      '--- YOUR TASK (Round 1 — Independent Challenge) ---',
      'Challenge the analyst CONSENSUS directly. Find the WEAKEST assumptions across all 4 analysts.',
      'Search for counter-evidence. Argue for a SMALLER or DIFFERENT impact than they suggest.',
      'Be specific — cite historical counterexamples, alternative interpretations, or data.',
      'You have NOT seen the Bull\'s argument — form your own independent bearish position.',
    ].join('\n')
  }

  const sections = [
    JSON_SCHEMA_INSTRUCTION,
    '',
    'You are the BEAR researcher in a structured financial debate.',
    'Your job is to CHALLENGE the consensus and find what the analysts got wrong.',
    `This is Round ${round} of the debate.`,
    '',
    `SIGNAL: ${signal.headline}`,
    ...briefSections,
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

  return sections.join('\n')
}

export async function runBearResearcher(params: {
  readonly round: number
  readonly analystAssessments: readonly AnalystAssessment[]
  readonly signal: Signal
  readonly bullArgument?: DebateArgument
  readonly ownPriorArgument?: DebateArgument
  readonly mode?: 'independent' | 'responsive'
  readonly humanCorrection?: string
}): Promise<DebateArgument> {
  const model = createGeminiChatModel({
    model: 'gemini-3-flash-preview',
    temperature: 0.5, // Slightly higher for creative counter-arguments
    maxOutputTokens: 3072,
    json: true,
  })

  const prompt = buildBearPrompt(params)
  let workingPrompt = prompt
  let lastFailure: DebateParseOutcome | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await model.invoke([new HumanMessage(workingPrompt)])
    const parsed = parseDebateArgument(extractResponseText(response.content))
    if (parsed.kind === 'ok') return parsed.data

    lastFailure = parsed
    const task = params.round === 1
      ? 'Challenge the analyst consensus. Find weakest assumptions and counter-evidence.'
      : 'Rebut the Bull\'s latest defense with NEW evidence.'
    workingPrompt = buildRetryPrompt(params.round, params.signal.headline, task, parsed)
  }

  const reason =
    lastFailure?.kind === 'parse_error'
      ? lastFailure.snippet
      : lastFailure?.kind === 'validation_error'
        ? lastFailure.message
        : 'unknown failure'

  return fallbackBearArgument(params.round, reason)
}
