import type { Signal, ExposureMap } from '@prism/shared'

/**
 * Builds the causal chain generation prompt.
 * This is the most critical prompt in the system — it determines
 * the quality of the causal graph visualization.
 */
export function buildCausalChainPrompt(
  signal: Signal,
  exposureMap: ExposureMap,
): string {
  const tradeableHoldings = Array.from(
    new Set(
      exposureMap.exposures.flatMap((entry) =>
        entry.contributingHoldings.map((holding) => holding.ticker.trim().toUpperCase()),
      ),
    ),
  ).sort()

  const exposureSummary = exposureMap.exposures
    .slice(0, 6)
    .map(
      (e) =>
        `- ${e.category}: ${e.percentage}% ($${e.valueCad.toLocaleString('en-CA', { maximumFractionDigits: 0 })}) via ${e.contributingHoldings.map((h) => h.ticker).join(', ')}`,
    )
    .join('\n')

  const overlapSummary = exposureMap.overlaps
    .slice(0, 5)
    .map((o) => `- ${o.assetName} (${o.assetTicker}): ${o.totalPercentage}% via ${o.sources.map((s) => s.fundTicker).join(' + ')}`)
    .join('\n')

  return `You are an expert financial causal analyst. Generate a causal propagation chain showing how a market event impacts a specific investor's portfolio.

## Event
**${signal.headline}**
${signal.description}
Sources: ${signal.sources.map((s) => s.title).join(', ')}
Temporal classification: ${signal.temporalClassification}

## Investor's Exposure Profile
${exposureSummary}

## Tradeable Holdings (Allowed asset node tickers)
${tradeableHoldings.map((ticker) => `- ${ticker}`).join('\n')}

### Overlapping Holdings
${overlapSummary}

## Instructions

Generate a causal chain as a JSON object tracing how this event propagates through economic mechanisms to the investor's specific holdings. Follow these STRICT rules:

1. **Node types must follow this progression:** event → mechanism → sector → asset
2. **NEVER link an event directly to an asset.** Every path MUST include at least one mechanism node explaining WHY the event affects the holding.
3. **Include COMPETING EFFECTS** where they exist. If this event is both positive AND negative for the same sector/asset through different mechanisms, include BOTH paths.
4. **Maximum 3 hops** from event to asset node. If a path requires more, set confidence below 0.3.
5. **Asset nodes must be tradeable holdings from the allowed ticker list above.** Do not use inferred underlying constituent tickers (like AAPL/MSFT) as asset nodes.
6. If underlying constituents explain the pathway, keep them in \`metadata.lookThroughConstituents\` on the tradeable holding node.
7. **Confidence scores (0-1):** 0.9+ for direct, well-documented causal links. 0.5-0.8 for plausible but indirect. Below 0.5 for speculative.
8. **Dollar and percentage impact** on asset nodes: estimate the near-term impact magnitude.

## Required JSON Schema

\`\`\`json
{
  "id": "chain-<unique>",
  "signalId": "${signal.id}",
  "generatedAt": "<ISO timestamp>",
  "nodes": [
    {
      "id": "n1",
      "type": "event",
      "label": "Short label",
      "description": "What happened",
      "confidence": 0.95,
      "metadata": { "sourceUrls": ["..."] }
    },
    {
      "id": "n2",
      "type": "mechanism",
      "label": "Economic mechanism",
      "description": "How event transmits to sector",
      "confidence": 0.8,
      "metadata": { "reasoning": "explanation" }
    },
    {
      "id": "n3",
      "type": "sector",
      "label": "Affected sector",
      "description": "Which sector and why",
      "confidence": 0.75,
      "metadata": {}
    },
    {
      "id": "n4",
      "type": "asset",
      "label": "Holding name",
      "description": "Specific impact on this holding",
      "confidence": 0.7,
      "dollarImpact": -500,
      "percentageImpact": -2.5,
      "metadata": { "ticker": "XIC", "reasoning": "..." }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "n1",
      "target": "n2",
      "magnitude": 0.8,
      "direction": "negative",
      "confidence": 0.85,
      "mechanism": "Human-readable explanation of this causal link"
    }
  ],
  "summary": "One paragraph summary of the full causal chain and net portfolio impact",
  "disclaimer": "This analysis is for informational purposes only and does not constitute financial advice. Causal relationships shown are AI-generated hypotheses, not guaranteed outcomes.",
  "maxHops": 3,
  "isSpeculative": false
}
\`\`\`

Generate 8-14 nodes and 8-18 edges for a concise but complete causal graph. Include multiple paths where the event affects different sectors through different mechanisms. Return ONLY the JSON object.`
}

/**
 * Builds a corrective prompt when initial response fails schema validation.
 */
export function buildRetryPrompt(
  originalPrompt: string,
  validationErrors: ReadonlyArray<string>,
): string {
  return `${originalPrompt}

IMPORTANT: Your previous response had these schema violations:
${validationErrors.map((e) => `- ${e}`).join('\n')}

Please regenerate with the corrected structure. Return ONLY valid JSON matching the schema above.`
}
