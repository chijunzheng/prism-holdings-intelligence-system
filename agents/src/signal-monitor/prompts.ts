import type { ExposureEntry } from '@prism/shared'

/**
 * Builds the search-grounding prompt scoped to the user's top exposures.
 * Only sends sector/percentage data — never user PII.
 */
export function buildSignalSearchPrompt(
  topExposures: ReadonlyArray<ExposureEntry>,
): string {
  const exposureList = topExposures
    .slice(0, 5)
    .map((e) => `- ${e.category} (${e.percentage}% of portfolio)`)
    .join('\n')

  return `You are a financial market analyst monitoring events for a Canadian investor's portfolio.

The investor has the following concentrated exposures:
${exposureList}

Search for the most significant RECENT market events (last 72 hours) that could impact these specific sectors. Focus on:
1. Central bank decisions (Bank of Canada, Federal Reserve)
2. Trade policy changes (tariffs, CUSMA, sanctions)
3. Commodity price moves (oil, gold, metals)
4. Major earnings or corporate events in these sectors
5. Regulatory changes affecting these industries

For each event found, provide a JSON array with this exact structure:
[
  {
    "headline": "Short event headline",
    "description": "2-3 sentence description of what happened and why it matters",
    "affectedExposures": ["Category names from the list above that are affected"],
    "relevanceScore": 0.0-1.0,
    "urgency": "low" | "medium" | "high" | "critical",
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
- Only include events with relevanceScore >= 0.5 to this specific portfolio
- Include source citations for every event
- Classify temporal impact: "transient" (days-weeks), "structural" (months-years), "ambiguous" (unclear)
- Maximum 5 signals, ranked by relevance
- If competing effects exist (positive AND negative for same sector), include both
- Return ONLY the JSON array, no other text`
}
