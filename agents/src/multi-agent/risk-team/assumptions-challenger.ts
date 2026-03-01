// Assumptions Challenger — devil's advocate on analyst assumptions
// Reviews all analyst assessments, finds counter-evidence, produces confidence haircut.
// Uses Gemini Flash with Search grounding for counter-evidence.

import { HumanMessage } from '@langchain/core/messages'
import {
  RiskChallengeSchema,
  type RiskChallenge,
  type AnalystAssessment,
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

type RiskChallengeParseOutcome =
  | { readonly kind: 'ok', readonly data: RiskChallenge }
  | { readonly kind: 'parse_error', readonly snippet: string }
  | { readonly kind: 'validation_error', readonly message: string }

function parseRiskChallenge(responseText: string): RiskChallengeParseOutcome {
  const jsonStr = extractJson(responseText)
  let parsed: unknown

  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return { kind: 'parse_error', snippet: jsonStr.slice(0, 300) }
  }

  const result = RiskChallengeSchema.safeParse(parsed)
  if (!result.success) {
    return { kind: 'validation_error', message: result.error.message }
  }

  return { kind: 'ok', data: result.data }
}

function buildRetryPrompt(originalPrompt: string, failure: RiskChallengeParseOutcome): string {
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

function fallbackRiskChallenge(reason: string): RiskChallenge {
  return {
    challengedAssumptions: [],
    recommendedConfidenceAdjustment: -0.1,
    overallAssessment: `Fallback risk challenge used due to JSON parsing/validation failure: ${reason.slice(0, 220)}`,
  }
}

function buildChallengerPrompt(params: {
  readonly analystAssessments: readonly AnalystAssessment[]
  readonly humanCorrection?: string
}): string {
  const { analystAssessments, humanCorrection } = params

  const assessmentSummaries = analystAssessments.map((a) => {
    const assumptions = a.keyAssumptions.map((k, i) => `  ${i + 1}. ${k}`).join('\n')
    return [
      `${a.analystType.toUpperCase()} ANALYST:`,
      `  Direction: ${a.overallDirection} (confidence: ${a.overallConfidence.toFixed(2)})`,
      `  Key Assumptions:\n${assumptions}`,
      `  Reasoning: ${a.reasoning}`,
    ].join('\n')
  })

  const sections = [
    'You are a Risk Assumptions Challenger. Your job is to be a genuine devil\'s advocate.',
    'For each analyst\'s key assumptions, find REAL counter-evidence that could prove them wrong.',
    '',
    'IMPORTANT RULES:',
    '- Find genuine counter-evidence. Do NOT accept "markets are uncertain" as a challenge.',
    '- Each challenge must cite specific evidence or historical precedent.',
    '- The recommendedConfidenceAdjustment must be negative (a haircut between -0.5 and 0).',
    '- Challenge at least 2 assumptions per analyst (8+ total across 4 analysts).',
    '',
    '--- ANALYST ASSESSMENTS ---',
    ...assessmentSummaries,
  ]

  if (humanCorrection) {
    sections.push(
      '',
      `--- USER CORRECTION (from Checkpoint 1) ---`,
      `The user has noted: "${humanCorrection}"`,
      'Factor this into your challenge. This correction takes priority over analyst assumptions.',
    )
  }

  sections.push(`
--- YOUR TASK ---
Challenge the analysts' assumptions. Search for counter-evidence.

Respond with valid JSON:
{
  "challengedAssumptions": [
    {
      "analystType": "macro" | "fundamental" | "sentiment" | "technical",
      "assumption": "The assumption being challenged",
      "counterEvidence": "Specific counter-evidence or historical precedent",
      "likelihoodOfBeingWrong": 0.0-1.0
    }
  ],
  "recommendedConfidenceAdjustment": -0.5 to 0,
  "overallAssessment": "Summary of challenges and recommended haircut"
}`)

  return sections.join('\n')
}

export async function runAssumptionsChallenger(params: {
  readonly analystAssessments: readonly AnalystAssessment[]
  readonly humanCorrection?: string
}): Promise<RiskChallenge> {
  const model = createGeminiChatModel({
    model: 'gemini-2.5-flash',
    temperature: 0.4, // Slightly higher for creative challenge-finding
    maxOutputTokens: 4096,
    json: true,
  })

  const prompt = buildChallengerPrompt(params)
  let workingPrompt = prompt
  let lastFailure: RiskChallengeParseOutcome | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await model.invoke([new HumanMessage(workingPrompt)])
    const parsed = parseRiskChallenge(extractResponseText(response.content))
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

  return fallbackRiskChallenge(reason)
}
