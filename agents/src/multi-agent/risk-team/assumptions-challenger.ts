// Assumptions Challenger — devil's advocate on analyst assumptions
// Reviews all analyst assessments, finds counter-evidence, produces confidence haircut.
// Uses Gemini Flash with Search grounding for counter-evidence.

import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage } from '@langchain/core/messages'
import {
  RiskChallengeSchema,
  type RiskChallenge,
  type AnalystAssessment,
} from '@prism/shared'

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]
  return text
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
  const model = new ChatGoogleGenerativeAI({
    model: 'gemini-2.0-flash',
    temperature: 0.4, // Slightly higher for creative challenge-finding
    maxOutputTokens: 4096,
  })

  const prompt = buildChallengerPrompt(params)
  const response = await model.invoke([new HumanMessage(prompt)])
  const responseText = typeof response.content === 'string'
    ? response.content
    : Array.isArray(response.content)
      ? response.content.map((c) => ('text' in c ? c.text : '')).join('')
      : ''

  const jsonStr = extractJson(responseText)
  const parsed = JSON.parse(jsonStr)
  const result = RiskChallengeSchema.safeParse(parsed)

  if (result.success) {
    return result.data
  }

  // Retry once
  const retryPrompt =
    `Your response had validation errors:\n${result.error.message}\n\n` +
    `Fix and respond with valid JSON. Original task:\n${prompt}`

  const retryResponse = await model.invoke([new HumanMessage(retryPrompt)])
  const retryText = typeof retryResponse.content === 'string'
    ? retryResponse.content
    : Array.isArray(retryResponse.content)
      ? retryResponse.content.map((c) => ('text' in c ? c.text : '')).join('')
      : ''

  const retryJson = extractJson(retryText)
  const retryParsed = JSON.parse(retryJson)
  const retryResult = RiskChallengeSchema.safeParse(retryParsed)

  if (retryResult.success) {
    return retryResult.data
  }

  throw new Error(`Assumptions Challenger failed validation after retry: ${retryResult.error.message}`)
}
