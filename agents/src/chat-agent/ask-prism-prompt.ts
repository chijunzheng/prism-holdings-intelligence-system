import type { AskPrismContext } from '@prism/shared'
import { buildSystemPrompt } from './prompts'

// ── Token Budget (1 token ≈ 4 chars) ─────────────────────────
const SECTION_BUDGETS = {
  portfolioHoldings: 500,  // Top 8 holdings by value
  exposureBreakdown: 400,  // Top 6 exposures
  activeSignals: 300,      // Top 3 signals
  signalDetail: 600,       // Optional
  planContext: 500,        // Optional
  personalContext: 500,    // Already budgeted
} as const

function truncateToTokenBudget(text: string, budgetTokens: number): string {
  const maxChars = budgetTokens * 4
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 3) + '...'
}

/**
 * Builds the unified Ask Prism prompt with all available context layers.
 * Formats holdings, exposures, signals, and optional signal/plan details
 * into a comprehensive, human-readable context block.
 * Applies token budgets per section to prevent unbounded growth.
 */
export function buildAskPrismPrompt(context: AskPrismContext, personalContextPrompt?: string): string {
  const sections: string[] = [buildSystemPrompt(context.profile), '']

  sections.push('## SESSION CONTEXT')
  sections.push(`- Page: ${context.page}`)
  sections.push(`- Session scope: ${context.sessionScope}`)
  sections.push(`- Snapshot generated: ${context.contextSnapshotMeta.generatedAt}`)
  sections.push(`- Active signals in snapshot: ${context.contextSnapshotMeta.activeSignalCount}`)
  if (context.contextSnapshotMeta.focusedSignalDetectedAt) {
    sections.push(`- Focused signal detected at: ${context.contextSnapshotMeta.focusedSignalDetectedAt}`)
  }
  if (context.entryContext) {
    sections.push(`- Entry type: ${context.entryContext.entryType}`)
    if (context.entryContext.signalId) sections.push(`- Entry signal id: ${context.entryContext.signalId}`)
    if (context.entryContext.nodeLabel) sections.push(`- Entry node: ${context.entryContext.nodeLabel}`)
  }
  sections.push('')

  if (context.contextSnapshotMeta.signalSourceSummary.length > 0) {
    sections.push('### Signal Source Coverage')
    const sourceSummary = context.contextSnapshotMeta.signalSourceSummary
      .slice(0, 8)
      .map((row) => `- ${row.signalId}: ${row.sourceCount} source(s)`)
      .join('\n')
    sections.push(sourceSummary)
    sections.push('')
  }

  // Layer 1: Portfolio context (always present)
  sections.push('## PORTFOLIO CONTEXT')
  sections.push('')

  // Top holdings by value (budgeted)
  sections.push('### Holdings')
  const totalPortfolioValue = context.holdings.reduce((sum, h) => sum + h.valueCad, 0)
  const sortedHoldings = [...context.holdings].sort((a, b) => b.valueCad - a.valueCad).slice(0, 8)
  const holdingsList = sortedHoldings
    .map((h) => {
      const weight = totalPortfolioValue > 0 ? (h.valueCad / totalPortfolioValue) * 100 : 0
      return `- ${h.ticker} (${h.name}): $${h.valueCad.toLocaleString('en-CA', { maximumFractionDigits: 0 })} (${weight.toFixed(1)}%)`
    })
    .join('\n')
  const holdingsText = holdingsList || '(no holdings)'
  sections.push(truncateToTokenBudget(
    context.holdings.length > 8
      ? `${holdingsText}\n(+${context.holdings.length - 8} more holdings)`
      : holdingsText,
    SECTION_BUDGETS.portfolioHoldings,
  ))
  sections.push('')

  // Top exposures (budgeted)
  sections.push('### Exposure Breakdown')
  const topExposures = [...context.exposureMap.exposures]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 6)
  const exposureList = topExposures
    .map((e) => {
      const contributors = e.contributingHoldings
        .map((ch) => `${ch.ticker} (${ch.contribution.toFixed(1)}%)`)
        .join(', ')
      return `- **${e.category}**: ${e.percentage.toFixed(1)}% ($${e.valueCad.toLocaleString('en-CA', { maximumFractionDigits: 0 })}) — via ${contributors}`
    })
    .join('\n')
  sections.push(truncateToTokenBudget(exposureList || '(no exposures)', SECTION_BUDGETS.exposureBreakdown))
  sections.push('')

  // Concentration warnings
  if (context.exposureMap.warnings.length > 0) {
    sections.push('### Concentration Warnings')
    const warningsList = context.exposureMap.warnings
      .map((w) => `- ${w.severity.toUpperCase()}: ${w.message}`)
      .join('\n')
    sections.push(warningsList)
    sections.push('')
  }

  // Overlaps
  if (context.exposureMap.overlaps.length > 0) {
    sections.push('### Overlapping Exposures')
    const overlapsList = context.exposureMap.overlaps
      .map((o) => `- ${o.assetName}: ${o.totalPercentage.toFixed(1)}% (overlaps ${o.sources.length} fund positions)`)
      .join('\n')
    sections.push(overlapsList)
    sections.push('')
  }

  // Active signals summary (budgeted, top 3)
  if (context.activeSignals.length > 0) {
    sections.push('### Active Market Signals')
    const topSignals = context.activeSignals.slice(0, 3)
    const signalsList = topSignals
      .map((s) => {
        const affectedExps = s.affectedExposures.join(', ')
        return `- **${s.headline}** (${s.urgency}, ${s.sentiment}): Affects ${affectedExps}`
      })
      .join('\n')
    const signalsText = context.activeSignals.length > 3
      ? `${signalsList}\n(+${context.activeSignals.length - 3} more signals)`
      : signalsList
    sections.push(truncateToTokenBudget(signalsText, SECTION_BUDGETS.activeSignals))
    sections.push('')
  }

  if (context.portfolioNetImpact) {
    sections.push('### Signals Overview Net Impact')
    sections.push(`- Included signals: ${context.portfolioNetImpact.includedSignalCount}/${context.portfolioNetImpact.signalUniverseCount}`)
    sections.push(`- 1-week impact: $${context.portfolioNetImpact.oneWeekImpactCad.toLocaleString('en-CA')}`)
    sections.push(`- 1-month impact: $${context.portfolioNetImpact.oneMonthImpactCad.toLocaleString('en-CA')}`)
    sections.push(`- 6-month impact: $${context.portfolioNetImpact.sixMonthImpactCad.toLocaleString('en-CA')}`)
    if (context.portfolioNetImpact.topContributors.length > 0) {
      sections.push('**Top contributors:**')
      sections.push(
        context.portfolioNetImpact.topContributors
          .map((item) => `- ${item.headline}: ${item.normalizedWeight.toFixed(2)} weight, $${item.oneMonthImpactCad.toLocaleString('en-CA')} (1M)`)
          .join('\n'),
      )
    }
    sections.push('')
  }

  // Layer 2: Signal detail context (optional)
  if (context.focusedSignal && context.causalChain && context.temporalAnalysis) {
    sections.push('## SIGNAL DETAIL CONTEXT')
    sections.push('')

    sections.push('### Focused Signal')
    sections.push(`**${context.focusedSignal.headline}**`)
    sections.push(context.focusedSignal.description)
    sections.push(`- Urgency: ${context.focusedSignal.urgency}`)
    sections.push(`- Sentiment: ${context.focusedSignal.sentiment}`)
    sections.push(`- Relevance score: ${context.focusedSignal.relevanceScore.toFixed(2)}`)
    sections.push(`- Affected exposures: ${context.focusedSignal.affectedExposures.join(', ')}`)
    sections.push('')

    if (context.focusedSignal.sources.length > 0) {
      sections.push('**Sources:**')
      const sourcesList = context.focusedSignal.sources
        .map((src) => `- [${src.title}](${src.url})`)
        .join('\n')
      sections.push(sourcesList)
      sections.push('')
    }

    sections.push('### Causal Chain')
    sections.push(context.causalChain.summary || '(no summary)')
    sections.push('')
    sections.push(`- Max hops: ${context.causalChain.maxHops}`)
    sections.push(`- Speculative: ${context.causalChain.isSpeculative ? 'YES' : 'NO'}`)
    sections.push(`- Nodes: ${context.causalChain.nodes.length}`)
    sections.push(`- Edges: ${context.causalChain.edges.length}`)
    sections.push('')

    // List all nodes with types and impacts
    sections.push('**Nodes:**')
    const nodesList = context.causalChain.nodes
      .map((n) => {
        let line = `- ${n.label} (${n.type}, confidence: ${Math.round(n.confidence * 100)}%)`
        if (n.dollarImpact !== undefined) {
          line += ` — $${n.dollarImpact.toLocaleString('en-CA')} impact`
        }
        if (n.temporalClassification) {
          line += ` — ${n.temporalClassification}`
        }
        return line
      })
      .join('\n')
    sections.push(nodesList)
    sections.push('')

    if (context.focusedNode) {
      sections.push('**Focused Node:**')
      sections.push(`- ${context.focusedNode.label} (${context.focusedNode.type})`)
      sections.push(`- Confidence: ${Math.round(context.focusedNode.confidence * 100)}%`)
      sections.push(`- Description: ${context.focusedNode.description}`)
      if (context.focusedNode.dollarImpact !== undefined) {
        sections.push(`- Node dollar impact: $${context.focusedNode.dollarImpact.toLocaleString('en-CA')}`)
      }
      sections.push('')
    }

    // List all edges with mechanisms
    sections.push('**Causal Mechanisms:**')
    const edgesList = context.causalChain.edges
      .map((e) => {
        const sourceNode = context.causalChain!.nodes.find((n) => n.id === e.source)
        const targetNode = context.causalChain!.nodes.find((n) => n.id === e.target)
        const direction = e.direction === 'positive' ? '↑' : e.direction === 'negative' ? '↓' : '~'
        return `- ${sourceNode?.label ?? e.source} ${direction} ${targetNode?.label ?? e.target}: ${e.mechanism} (confidence: ${Math.round(e.confidence * 100)}%)`
      })
      .join('\n')
    sections.push(edgesList)
    sections.push('')

    if (context.causalChain.disclaimer) {
      sections.push(`**Disclaimer:** ${context.causalChain.disclaimer}`)
      sections.push('')
    }

    sections.push('### Temporal Analysis')
    sections.push(`- Classification: ${context.temporalAnalysis.classification} (confidence: ${Math.round(context.temporalAnalysis.confidence * 100)}%)`)
    sections.push(`- 1-week impact: $${context.temporalAnalysis.timeBuckets.oneWeek.expectedDollarImpact.toLocaleString('en-CA')}`)
    sections.push(`- 1-month impact: $${context.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact.toLocaleString('en-CA')}`)
    sections.push(`- 6-month impact: $${context.temporalAnalysis.timeBuckets.sixMonth.expectedDollarImpact.toLocaleString('en-CA')}`)
    sections.push('')

    if (context.temporalAnalysis.counterfactual) {
      sections.push('**Counterfactual Analysis:**')
      sections.push(`- Scenario: ${context.temporalAnalysis.counterfactual.scenario}`)
      sections.push(`- Outcome difference: $${context.temporalAnalysis.counterfactual.estimatedOutcomeDifferenceCad.toLocaleString('en-CA')}`)
      sections.push(`- Explanation: ${context.temporalAnalysis.counterfactual.explanation}`)
      sections.push('')
    }
  }

  // Layer 3: Plan context (optional)
  if (context.strategyCandidates || context.currentPlan || context.evaluation) {
    sections.push('## PLAN CONTEXT')
    sections.push('')

    if (context.strategyCandidates && context.strategyCandidates.length > 0) {
      sections.push('### Strategy Candidates')
      const candidatesList = context.strategyCandidates
        .map((c) => {
          return [
            `- **${c.ticker} (${c.name})**`,
            `  - Type: ${c.type}`,
            `  - Rationale: ${c.rationale}`,
            `  - Confidence: ${Math.round(c.confidence * 100)}%`,
            `  - Expected mitigation: $${c.expectedMitigationCad.toLocaleString('en-CA')}`,
            `  - Proposed shift: ${c.proposedShiftPct.toFixed(1)}%`,
            `  - Diversification score: ${c.diversificationScore.toFixed(2)}`,
            `  - Turnover cost: $${c.estimatedTurnoverCostCad.toLocaleString('en-CA')}`,
            `  - Tax cost: $${c.estimatedTaxCostCad.toLocaleString('en-CA')}`,
            `  - Liquidity tier: ${c.liquidityTier}`,
          ].join('\n')
        })
        .join('\n')
      sections.push(candidatesList)
      sections.push('')
    }

    if (context.currentPlan && context.currentPlan.length > 0) {
      sections.push('### Current Plan Selection')
      const planList = context.currentPlan
        .map((p) => `- ${p.ticker} (${p.name}): ${p.allocationPct.toFixed(1)}% allocation`)
        .join('\n')
      sections.push(planList)
      sections.push('')
    }

    if (context.evaluation) {
      sections.push('### Plan Evaluation')
      sections.push(`- Objective: ${context.evaluation.objective}`)
      sections.push(`- Objective satisfied: ${context.evaluation.objectiveSatisfied ? 'YES' : 'NO'}`)
      sections.push(`- Score: ${context.evaluation.score.toFixed(2)}`)
      sections.push('')
      sections.push('**Impact Comparison:**')
      sections.push(`- Baseline 1-month: $${context.evaluation.baselineOneMonthCad.toLocaleString('en-CA')}`)
      sections.push(`- Proposed 1-month: $${context.evaluation.proposedOneMonthCad.toLocaleString('en-CA')}`)
      sections.push(`- Downside reduction: $${context.evaluation.downsideReductionCad.toLocaleString('en-CA')}`)
      sections.push(`- Baseline 6-month: $${context.evaluation.baselineSixMonthCad.toLocaleString('en-CA')}`)
      sections.push(`- Proposed 6-month: $${context.evaluation.proposedSixMonthCad.toLocaleString('en-CA')}`)
      sections.push(`- 6-month guardrail delta: $${context.evaluation.sixMonthGuardrailDeltaCad.toLocaleString('en-CA')}`)
      sections.push('')
      sections.push('**Costs:**')
      sections.push(`- Turnover: ${context.evaluation.turnoverPct.toFixed(1)}% (cap: ${context.evaluation.turnoverCapPct.toFixed(1)}%)`)
      sections.push(`- Tax penalty: $${context.evaluation.taxPenaltyCad.toLocaleString('en-CA')}`)
      sections.push(`- Diversification gain: ${context.evaluation.diversificationGain.toFixed(2)}`)
      sections.push('')

      if (context.evaluation.warnings.length > 0) {
        sections.push('**Warnings:**')
        const evalWarnings = context.evaluation.warnings.map((w) => `- ${w}`).join('\n')
        sections.push(evalWarnings)
        sections.push('')
      }
    }
  }

  // Personal context (corrections, analysis memory, assertions)
  if (personalContextPrompt) {
    sections.push(personalContextPrompt)
    sections.push('')
  }

  sections.push('RESPONSE FORMAT:')
  sections.push('')
  sections.push('RULE 1 — GREETINGS AND CASUAL MESSAGES (HIGHEST PRIORITY):')
  sections.push('For greetings ("what\'s up", "hey", "hello", "how\'s it going", "yo", "sup") and casual/vague messages, respond in PLAIN TEXT only:')
  sections.push('- Greet the user warmly by name (1 sentence)')
  sections.push('- Optionally mention one high-level portfolio observation (1 sentence max, using the actual portfolio value from the context data)')
  sections.push('- Do NOT generate structured JSON for greetings. Do NOT list all signals. Do NOT do a full portfolio analysis.')
  sections.push('- End with 2-3 >> follow-up suggestions that guide the user toward actionable next steps.')
  sections.push('- Example follow-ups: ">> Run a full portfolio review", ">> Tell me about the Nvidia signal", ">> How risky is my portfolio?"')
  sections.push('')
  sections.push('RULE 2 — PORTFOLIO QUESTIONS:')
  sections.push('If the user explicitly asks about their portfolio, holdings, signals, exposure, risk, or market impact — respond ONLY with the structured JSON (no preamble, no text before or after).')
  sections.push('')
  sections.push('RULE 3 — GENERAL/CONVERSATIONAL:')
  sections.push('For general knowledge, explanations, or follow-ups — respond in plain text with >> follow-up suggestions.')
  sections.push('')
  sections.push('PLAIN TEXT FORMAT:')
  sections.push('Keep responses concise. Avoid markdown headings.')
  sections.push('After your main response, include 2-3 follow-up suggestions prefixed with ">> ".')
  sections.push('')
  sections.push('JSON SCHEMA:')
  sections.push('{ "sections": [...], "followUps": [...] }')
  sections.push('')
  sections.push('SECTION TYPES:')
  sections.push('- summary: { type: "summary", sentiment: "positive"|"negative"|"mixed"|"neutral", headline: string, body?: string, stats?: [{ label, value, sentiment? }] }')
  sections.push('- signal_item: { type: "signal_item", sentiment, headline, body, tickers?: string[], exposureAmount?: string, signalId?: string, sourceTitle?: string, sourceUrl?: string }')
  sections.push('- holding_item: { type: "holding_item", ticker, name, value, detail?: string, relatedSignals?: string[] }')
  sections.push('- text: { type: "text", body: string } (markdown paragraph)')
  sections.push('- insight: { type: "insight", icon: "tip"|"warning"|"info"|"positive", title?: string, body, actionLabel?: string, actionPrompt?: string }')
  sections.push('- metric_row: { type: "metric_row", metrics: [{ label, value, sentiment? }] }')
  sections.push('- group: { type: "group", title, defaultOpen: boolean, sections: [...nested sections] }')
  sections.push('')
  sections.push('followUps: [{ text: string, priority: "primary"|"secondary" }]')
  sections.push('')
  sections.push('GUIDELINES:')
  sections.push('- Always start with a "summary" section answering "am I okay?" in one line')
  sections.push('- Use signal_item ONLY when listing multiple signals in an overview. When the user asks about ONE specific signal (e.g. "Tell me more about: X"), do NOT re-render it as a signal_item — the user already sees that card. Instead, provide deeper analysis using summary, text, holding_item, insight, and metric_row sections.')
  sections.push('- Use holding_item when discussing specific holdings — use dollar amounts')
  sections.push('- Use insight for key personalized takeaways or warnings')
  sections.push('- Use group to organize signals by theme (e.g. "Tailwinds" / "Headwinds" / "Watch closely")')
  sections.push('- Use text sparingly for connecting narrative between structured sections')
  sections.push('- 2-3 followUps, mark the most actionable as "primary"')
  sections.push('- Keep all text concise, plain English, dollar amounts over percentages')
  sections.push('- Reference specific holdings, exposures, or plan details when relevant')
  sections.push('')
  sections.push('EXAMPLE (signals overview):')
  sections.push('```json')
  sections.push(JSON.stringify({
    sections: [
      { type: 'summary', sentiment: 'mixed', headline: 'Your portfolio has some headwinds, but nothing urgent', stats: [{ label: 'Net impact (1M)', value: '-$180' }, { label: 'Active signals', value: '3' }] },
      { type: 'group', title: 'Headwinds', defaultOpen: true, sections: [
        { type: 'signal_item', sentiment: 'negative', headline: 'Bank of Canada rate decision', body: 'A 25bps hike could pressure your bank holdings short-term.', tickers: ['ZEB'], exposureAmount: '$4,200' },
      ] },
      { type: 'group', title: 'Tailwinds', defaultOpen: true, sections: [
        { type: 'signal_item', sentiment: 'positive', headline: 'US tech earnings beat expectations', body: 'Strong results from mega-caps support your VFV position.', tickers: ['VFV'], exposureAmount: '$12,500' },
      ] },
      { type: 'insight', icon: 'tip', title: 'Net effect is smaller than it looks', body: 'The rate hike headwind and tech tailwind partially offset each other across your portfolio.' },
    ],
    followUps: [
      { text: 'Run a full portfolio review', priority: 'primary' },
      { text: 'How does the rate decision affect my banks?', priority: 'secondary' },
    ],
  }, null, 2))
  sections.push('```')

  return sections.join('\n')
}
