import type { CausalChainNode, CausalChain, ExposureMap, UserProfile, Signal } from '@prism/shared'
import type { TemporalAnalysis } from './types'

/**
 * Builds the system prompt that constrains chat agent behavior.
 * This is the most critical prompt in the chat system — it determines
 * whether the agent stays within regulatory boundaries.
 */
export function buildSystemPrompt(profile: UserProfile): string {
  return `You are the Prism chat assistant. You help users understand how market events affect their specific portfolio holdings.

ABOUT THE USER:
- Name: ${profile.name}, Age: ${profile.age}
- Risk tolerance: ${profile.riskTolerance}
- Financial literacy: ${profile.financialLiteracy}
- Goals: ${profile.goals.join(', ')}
- Investment horizon: ${profile.investmentHorizonYears} years
- Preferred detail level: ${profile.preferences.detailLevel}

BEHAVIORAL RULES (MANDATORY — violations are unacceptable):
1. NEVER give a definitive buy/sell recommendation. Always present OPTIONS with tradeoffs.
2. ALWAYS cite sources for factual claims using [Source Title](url) format.
3. ALWAYS reference the user's specific context (age, goals, risk tolerance) in recommendations.
4. When asked "What should I do?", present 2-3 options with clear tradeoffs.
5. When asked "Show me the other side", present the strongest contrarian case against your prior analysis.
6. When confidence is low (below 0.5), say so explicitly.
7. NEVER suppress uncertainty. If you are not sure, say so.
8. Keep responses concise — 2-4 paragraphs max unless the user asks for detail.
9. Adapt language complexity to the user's financial literacy level: ${profile.financialLiteracy}.

FORMATTING RULES (MANDATORY):
- Use bullet points for lists of signals, impacts, and key points. Never write long paragraphs.
- Use markdown headings (##, ###) to organize sections logically.
- Lead with a 1-sentence summary, then break down details in bullets.
- Use **bold** for signal names, dollar amounts, and key terms.
- Use plain English and dollar amounts ("could cost ~$280") not percentages.
- When discussing multiple signals, describe each with its own bullet or heading.
- Keep each bullet to 1-2 sentences max.

NOTE: A persistent disclaimer is shown in the app UI. Do NOT repeat the disclaimer in your messages."`
}

/**
 * Builds the initial context message that summarizes the selected node's
 * role in the causal chain — sent as the first assistant message.
 */
export function buildNodeContextPrompt(
  node: CausalChainNode,
  chain: CausalChain,
  exposureMap: ExposureMap,
  signal: Signal,
  temporalAnalysis: TemporalAnalysis,
): string {
  const connectedEdges = chain.edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  )
  const edgeDescriptions = connectedEdges
    .map((e) => {
      const direction = e.direction === 'positive' ? 'positively' : e.direction === 'negative' ? 'negatively' : 'ambiguously'
      return `- ${e.mechanism} (${direction}, confidence: ${Math.round(e.confidence * 100)}%)`
    })
    .join('\n')

  const topExposures = exposureMap.exposures
    .slice(0, 5)
    .map((e) => `- ${e.category}: ${e.percentage.toFixed(1)}% ($${e.valueCad.toLocaleString('en-CA', { maximumFractionDigits: 0 })})`)
    .join('\n')

  const sources = signal.sources
    .map((s) => `- [${s.title}](${s.url})`)
    .join('\n')

  return `The user has selected the following node on the causal graph. Provide a concise opening summary explaining this node's role.

## Selected Node
- Label: ${node.label}
- Type: ${node.type}
- Description: ${node.description}
- Confidence: ${Math.round(node.confidence * 100)}%
${node.dollarImpact !== undefined ? `- Dollar impact: $${node.dollarImpact.toLocaleString('en-CA')}` : ''}
${node.temporalClassification ? `- Temporal classification: ${node.temporalClassification}` : ''}

## Causal Connections
${edgeDescriptions}

## Originating Signal
**${signal.headline}**: ${signal.description}

## User's Top Exposures
${topExposures}

## Temporal Analysis
- Overall classification: ${temporalAnalysis.classification} (confidence: ${Math.round(temporalAnalysis.confidence * 100)}%)
- 1-week impact: $${temporalAnalysis.timeBuckets.oneWeek.expectedDollarImpact.toLocaleString('en-CA')}
- 1-month impact: $${temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact.toLocaleString('en-CA')}
- 6-month impact: $${temporalAnalysis.timeBuckets.sixMonth.expectedDollarImpact.toLocaleString('en-CA')}

## Sources
${sources}

${chain.isSpeculative ? '**WARNING:** This causal chain extends beyond 3 hops and should be flagged as speculative.' : ''}

Summarize this node's role concisely.`
}

/**
 * Detects whether a user message is a "what-if" question that requires
 * re-generation of the causal chain with modified assumptions.
 */
export function buildWhatIfDetectionPrompt(userMessage: string): string {
  return `Analyze this user message and determine if it's a "what if" question that requires re-generating the causal chain with a modified assumption.

User message: "${userMessage}"

Respond with JSON only:
{
  "isWhatIf": true/false,
  "modifiedAssumption": "the modified assumption to use for re-generation, or null"
}

Examples of what-if questions:
- "What if this is only temporary?" → { "isWhatIf": true, "modifiedAssumption": "The event is temporary and reverses within 2 weeks" }
- "What if interest rates don't actually change?" → { "isWhatIf": true, "modifiedAssumption": "Interest rates remain unchanged" }
- "Why does this affect my portfolio?" → { "isWhatIf": false, "modifiedAssumption": null }

Return ONLY the JSON object.`
}
