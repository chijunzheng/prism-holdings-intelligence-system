import type { ExposureEntry } from '@prism/shared'

/**
 * Builds the search-grounding prompt scoped to the user's top exposures.
 * Only sends sector/percentage data — never user PII.
 */
export function buildSignalSearchPrompt(
  topExposures: ReadonlyArray<ExposureEntry>,
): string {
  const exposureList = topExposures
    .slice(0, 3)
    .map((e) => `- ${e.category} (${e.percentage}% of portfolio)`)
    .join('\n')

  return `You are a financial market analyst monitoring events for a Canadian investor's portfolio.

The investor has the following concentrated exposures:
${exposureList}

Search for the most significant RECENT market events (last 72 hours) that could impact these specific sectors.
If little happened in 72 hours, broaden to the last 7 days and include clearly relevant events. Focus on:
1. Central bank decisions (Bank of Canada, Federal Reserve)
2. Trade policy changes (tariffs, CUSMA, sanctions)
3. Commodity price moves (oil, gold, metals)
4. Major earnings or corporate events in these sectors
5. Regulatory changes affecting these industries

For each event found, provide a JSON array with this exact structure:
[
  {
    "headline": "Concise event headline (max 8 words)",
    "description": "One sentence: what happened and why it matters. Max 15 words.",
    "portfolioSummary": "One short sentence on portfolio impact. Max 15 words. Example: 'Benefits your 16% energy exposure but may pressure financials.'",
    "affectedExposures": ["Category names from the list above that are affected"],
    "relevanceScore": 0.0-1.0,
    "urgency": "low" | "medium" | "high" | "critical",
    "sentiment": "positive" | "negative" | "mixed",
    "temporalClassification": "transient" | "structural" | "ambiguous",
    "sources": [
      {
        "title": "Source article title",
        "url": "https://...",
        "publisher": "Publisher name"
      }
    ]
  }
]

Rules:
- Prefer events with relevanceScore >= 0.5, but include weaker links (0.3-0.49) if no stronger signals are found
- Include source citations for every event
- Classify sentiment: "positive" if the event benefits the investor's holdings, "negative" if it hurts them, "mixed" if competing effects
- Classify temporal impact: "transient" (days-weeks), "structural" (months-years), "ambiguous" (unclear)
- Maximum 5 signals, ranked by relevance
- Return at least 1 signal when plausible market events exist for these exposures
- If competing effects exist (positive AND negative for same sector), include both
- BREVITY IS CRITICAL: headlines, descriptions, and portfolioSummary must be short enough to display on a small card without truncation. Avoid filler words, qualifiers, and redundant context.
- Return ONLY the JSON array, no other text`
}
