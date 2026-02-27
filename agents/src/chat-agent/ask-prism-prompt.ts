import type { AskPrismContext } from '@prism/shared'
import { buildSystemPrompt } from './prompts'

/**
 * Builds the unified Ask Prism prompt with all available context layers.
 * Formats holdings, exposures, signals, and optional signal/plan details
 * into a comprehensive, human-readable context block.
 */
export function buildAskPrismPrompt(context: AskPrismContext): string {
  const sections: string[] = [buildSystemPrompt(context.profile), '']

  // Layer 1: Portfolio context (always present)
  sections.push('## PORTFOLIO CONTEXT')
  sections.push('')

  // All holdings with weights
  sections.push('### Holdings')
  const totalPortfolioValue = context.holdings.reduce((sum, h) => sum + h.valueCad, 0)
  const holdingsList = context.holdings
    .map((h) => {
      const weight = totalPortfolioValue > 0 ? (h.valueCad / totalPortfolioValue) * 100 : 0
      return `- ${h.ticker} (${h.name}): $${h.valueCad.toLocaleString('en-CA', { maximumFractionDigits: 0 })} (${weight.toFixed(1)}%)`
    })
    .join('\n')
  sections.push(holdingsList || '(no holdings)')
  sections.push('')

  // Complete exposure breakdown
  sections.push('### Exposure Breakdown')
  const exposureList = context.exposureMap.exposures
    .map((e) => {
      const contributors = e.contributingHoldings
        .map((ch) => `${ch.ticker} (${ch.contribution.toFixed(1)}%)`)
        .join(', ')
      return `- **${e.category}**: ${e.percentage.toFixed(1)}% ($${e.valueCad.toLocaleString('en-CA', { maximumFractionDigits: 0 })}) — via ${contributors}`
    })
    .join('\n')
  sections.push(exposureList || '(no exposures)')
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
      .map((o) => `- ${o.category}: ${o.percentage.toFixed(1)}% (overlaps ${o.overlappingCount} holdings)`)
      .join('\n')
    sections.push(overlapsList)
    sections.push('')
  }

  // Active signals summary
  if (context.activeSignals.length > 0) {
    sections.push('### Active Market Signals')
    const signalsList = context.activeSignals
      .map((s) => {
        const affectedExps = s.affectedExposures.join(', ')
        return `- **${s.headline}** (${s.urgency}, ${s.sentiment}): Affects ${affectedExps}`
      })
      .join('\n')
    sections.push(signalsList)
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

  sections.push('TASK:')
  sections.push('Answer the user's question using the context above. Keep responses concise and practical.')
  sections.push('Reference specific holdings, exposures, or plan details when relevant.')
  sections.push('Avoid markdown headings.')

  return sections.join('\n')
}
