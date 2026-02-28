// Bull Researcher — builds the strongest case FOR the analyst consensus.
// Round 1: Synthesizes all 4 analyst views into a coherent thesis.
// Subsequent rounds: Responds to Bear's counterarguments with evidence.

import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage } from '@langchain/core/messages'
import {
  DebateArgumentSchema,
  type DebateArgument,
  type AnalystAssessment,
  type Signal,
  type ExposureMap,
} from '@prism/shared'

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
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
}): string {
  const { round, analystAssessments, signal, bearArgument, ownPriorArgument } = params

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
}): Promise<DebateArgument> {
  const model = new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    temperature: 0.4,
    maxOutputTokens: 3072,
  })

  const prompt = buildBullPrompt(params)
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
