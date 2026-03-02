// Synthesize a research brief from grounding metadata captured during signal detection.
// Uses the same Gemini client as the signal monitor (not LangChain) with NO search grounding —
// this synthesizes from already-grounded data, not new searches.

import type { Signal, SignalResearchBrief } from '@prism/shared'
import { SignalResearchBriefSchema } from '@prism/shared'
import type { GroundingContext } from './parse'
import { getGeminiClient } from '../utils/gemini-client'
import { getSignalMonitorModelName } from '../utils/env'

function buildSynthesisPrompt(signal: Signal, groundingContext: GroundingContext): string {
  const sourceTitles = groundingContext.sources
    .map((s, i) => `  [${i}] ${s.title} (${s.domain ?? 'unknown'})`)
    .join('\n')

  const evidenceSegments = groundingContext.supportSegments
    .map((seg) => `  - "${seg.text}" [sources: ${seg.sourceIndices.join(', ')}]`)
    .join('\n')

  const queries = groundingContext.searchQueries
    .map((q) => `  - ${q}`)
    .join('\n')

  return `You are a financial research analyst. Synthesize the following grounding evidence into a structured research brief.

SIGNAL:
  Headline: ${signal.headline}
  Description: ${signal.description}
  Affected Exposures: ${signal.affectedExposures.join(', ')}
  Urgency: ${signal.urgency}

GROUNDING SOURCES:
${sourceTitles || '  (none)'}

EVIDENCE SEGMENTS:
${evidenceSegments || '  (none)'}

SEARCH QUERIES USED:
${queries || '  (none)'}

Synthesize this into a JSON research brief. Be factual — only include claims supported by the evidence above.

Respond with ONLY valid JSON matching this schema:
{
  "keyFacts": ["3-5 key factual findings from the evidence"],
  "causalMechanism": "The primary causal chain from signal to market impact (1-2 sentences)",
  "historicalPrecedents": ["0-3 historical parallels mentioned in the evidence"],
  "knownUnknowns": ["1-3 important unknowns or uncertainties identified"],
  "searchQueries": ["The search queries that produced this evidence"]
}`
}

export async function synthesizeResearchBrief(params: {
  readonly signal: Signal
  readonly groundingContext: GroundingContext
}): Promise<SignalResearchBrief> {
  const { signal, groundingContext } = params

  // Skip synthesis if there's no meaningful grounding data
  if (groundingContext.sources.length === 0 && groundingContext.supportSegments.length === 0) {
    return {
      keyFacts: [signal.description],
      causalMechanism: 'Insufficient grounding data to determine causal mechanism.',
      historicalPrecedents: [],
      knownUnknowns: ['Limited grounding evidence available for this signal.'],
      searchQueries: [...groundingContext.searchQueries],
    }
  }

  const genai = getGeminiClient()
  const prompt = buildSynthesisPrompt(signal, groundingContext)

  const response = await genai.models.generateContent({
    model: getSignalMonitorModelName(),
    contents: prompt,
    config: {
      // No search grounding — synthesizing from already-grounded data
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  })

  const responseText = response.text ?? ''
  const parsed = JSON.parse(responseText)
  return SignalResearchBriefSchema.parse(parsed)
}
