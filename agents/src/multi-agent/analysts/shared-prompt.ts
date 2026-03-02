// Shared Prompt Builder — constructs common context for all analyst agents.
// Each analyst receives identical portfolio/signal context but a different mandate.

import type {
  Signal,
  Portfolio,
  ExposureMap,
  InferredRiskProfile,
  MarketDataBundle,
  AnalystType,
} from '@prism/shared'

// ── Analyst Mandates ────────────────────────────────────────
const ANALYST_MANDATES: Record<AnalystType, {
  readonly title: string
  readonly mandate: string
  readonly groundingFocus: string
  readonly outputFocus: string
}> = {
  macro: {
    title: 'Macro Analyst',
    mandate:
      'Analyze monetary policy, fiscal policy, trade flows, currency dynamics, and sovereign risk transmission channels. ' +
      'Focus on how macroeconomic forces propagate through sectors to the portfolio holdings.',
    groundingFocus: 'Central bank decisions, trade policy changes, GDP data, inflation reports, currency movements',
    outputFocus: 'Sector-level directional impact and magnitude assessment',
  },
  fundamental: {
    title: 'Fundamental Analyst',
    mandate:
      'Analyze earnings impact, valuation shifts, and business model effects on specific holdings via look-through constituents. ' +
      'Focus on company-level fundamentals and how the signal changes earning power or intrinsic value. ' +
      'Search for recent earnings reports, analyst upgrades/downgrades, and financial news articles. Include source URLs.',
    groundingFocus: 'Earnings data, analyst consensus estimates, P/E ratios, revenue growth, margin impacts, analyst reports, financial news articles',
    outputFocus: 'Holding-level earnings and valuation impact',
  },
  sentiment: {
    title: 'Sentiment Analyst',
    mandate:
      'Analyze market sentiment direction, momentum, positioning, and whether the signal is already priced in. ' +
      'Focus on how market participants have already reacted and what remains unpriced. ' +
      'Search for social media sentiment (Reddit, X/Twitter, StockTwits), news coverage, and market commentary. Include source URLs.',
    groundingFocus: 'Social media sentiment (Reddit, X/Twitter, StockTwits), market news, institutional vs retail flow, options positioning, futures pricing, financial news commentary',
    outputFocus: 'Sentiment indicators, momentum assessment, and pricing-in evaluation',
  },
  technical: {
    title: 'Technical Analyst',
    mandate:
      'Analyze support/resistance levels, trend structure, historical volatility, and price ranges for affected sectors and holdings. ' +
      'Use the REAL volatility data provided — do not guess or estimate volatility.',
    groundingFocus: 'Price levels, historical returns, sector volatility, moving averages, technical patterns',
    outputFocus: 'Price targets and range estimates per time horizon',
  },
}

export function getAnalystMandate(analystType: AnalystType) {
  return ANALYST_MANDATES[analystType]
}

// ── Format Portfolio Context ────────────────────────────────
function formatPortfolioContext(portfolio: Portfolio): string {
  const allHoldings = portfolio.accounts.flatMap((a) => a.holdings)

  const holdingLines = allHoldings.map((h) => {
    const pct = ((h.valueCad / portfolio.totalValueCad) * 100).toFixed(1)
    return `  ${h.ticker} — ${h.name} — $${h.valueCad.toLocaleString()} (${pct}%) [${h.type}, ${h.accountType}]`
  })

  return [
    `Total Portfolio Value: $${portfolio.totalValueCad.toLocaleString()} CAD`,
    `Holdings (${allHoldings.length}):`,
    ...holdingLines,
  ].join('\n')
}

// ── Format Exposure Context ─────────────────────────────────
function formatExposureContext(exposureMap: ExposureMap): string {
  const topExposures = [...exposureMap.exposures]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 8)

  const exposureLines = topExposures.map(
    (e) => `  ${e.category}: ${e.percentage.toFixed(1)}% ($${e.valueCad.toLocaleString()})`,
  )

  const warningLines = exposureMap.warnings
    .filter((w) => w.severity === 'high' || w.severity === 'critical')
    .map((w) => `  ⚠ ${w.message}`)

  return [
    'Top Sector Exposures:',
    ...exposureLines,
    ...(warningLines.length > 0 ? ['\nConcentration Warnings:', ...warningLines] : []),
  ].join('\n')
}

// ── Format Signal Context ───────────────────────────────────
function formatSignalContext(signal: Signal): string {
  const sourceList = signal.sources
    .slice(0, 3)
    .map((s) => `  - ${s.title} (${s.publisher ?? 'unknown'})`)
    .join('\n')

  const sections = [
    `Headline: ${signal.headline}`,
    `Description: ${signal.description}`,
    `Urgency: ${signal.urgency}`,
    `Sentiment: ${signal.sentiment}`,
    `Temporal Classification: ${signal.temporalClassification}`,
    `Affected Exposures: ${signal.affectedExposures.join(', ')}`,
    `Sources:\n${sourceList}`,
  ]

  // Inject research brief when available — shared factual context for all analysts
  const brief = signal.researchBrief
  if (brief) {
    const facts = brief.keyFacts.map((f) => `  - ${f}`).join('\n')
    const precedents = brief.historicalPrecedents.length > 0
      ? `Historical Precedents:\n${brief.historicalPrecedents.map((p) => `  - ${p}`).join('\n')}`
      : ''
    const unknowns = brief.knownUnknowns.length > 0
      ? `Known Unknowns:\n${brief.knownUnknowns.map((u) => `  - ${u}`).join('\n')}`
      : ''

    sections.push(
      '',
      '--- RESEARCH BRIEF (from signal detection grounding) ---',
      `Key Facts:\n${facts}`,
      `Causal Mechanism: ${brief.causalMechanism}`,
      ...(precedents ? [precedents] : []),
      ...(unknowns ? [unknowns] : []),
      '',
      'NOTE: Search for ADDITIONAL evidence from your perspective. Do NOT simply repeat this brief.',
    )
  }

  return sections.join('\n')
}

// ── Format Risk Profile Context ─────────────────────────────
function formatRiskProfileContext(riskProfile: InferredRiskProfile): string {
  const lines = [
    `Risk Tolerance: ${riskProfile.riskTolerance} (score: ${riskProfile.riskScore}/100)`,
  ]

  if (riskProfile.declaredTolerance) {
    lines.push(`Declared by user: ${riskProfile.declaredTolerance}`)
  }

  if (riskProfile.mismatch?.detected) {
    lines.push(`Mismatch: ${riskProfile.mismatch.explanation}`)
  }

  return lines.join('\n')
}

// ── Format Market Data Context (Technical Analyst) ──────────
function formatMarketDataContext(marketData: MarketDataBundle): string {
  const volLines = Object.entries(marketData.volatilities).map(([ticker, vol]) =>
    `  ${ticker}: daily=${(vol.daily * 100).toFixed(2)}%, monthly=${(vol.monthly * 100).toFixed(1)}%, annual=${(vol.annualized * 100).toFixed(1)}%`,
  )

  return [
    `Source: ${marketData.source} (fetched: ${marketData.fetchedAt.split('T')[0]})`,
    'Volatilities:',
    ...volLines,
  ].join('\n')
}

// ── Build Holding Tickers for Output ────────────────────────
function formatHoldingsList(portfolio: Portfolio): string {
  const allHoldings = portfolio.accounts.flatMap((a) => a.holdings)
  return allHoldings
    .map((h) => `{ ticker: "${h.ticker}", name: "${h.name}" }`)
    .join(', ')
}

// ── Shared Context Builder (computed once, reused by all analysts) ──
export function buildSharedAnalystContext(params: {
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly riskProfile: InferredRiskProfile
  readonly marketData?: MarketDataBundle
}): string {
  const { signal, portfolio, exposureMap, riskProfile, marketData } = params

  const sections = [
    `\n--- SIGNAL ---\n${formatSignalContext(signal)}`,
    `\n--- PORTFOLIO ---\n${formatPortfolioContext(portfolio)}`,
    `\n--- EXPOSURE MAP ---\n${formatExposureContext(exposureMap)}`,
    `\n--- RISK PROFILE ---\n${formatRiskProfileContext(riskProfile)}`,
  ]

  if (marketData) {
    sections.push(`\n--- MARKET DATA (REAL — use these numbers, do not guess) ---\n${formatMarketDataContext(marketData)}`)
  }

  return sections.join('\n')
}

// ── Analyst-Specific Prompt Builder (uses pre-built shared context) ──
export function buildAnalystSpecificPrompt(
  sharedContext: string,
  analystType: AnalystType,
  portfolio: Portfolio,
  _marketData?: MarketDataBundle,
): string {
  const mandate = ANALYST_MANDATES[analystType]

  const sections = [
    `You are a ${mandate.title}. Your SPECIFIC mandate is:\n${mandate.mandate}`,
    sharedContext,
  ]

  // Only include market data context for technical analyst if not already in shared
  // (shared context includes it when available, so just note the mandate)

  sections.push(`
--- YOUR TASK ---
Analyze this signal's impact on the portfolio from your specific perspective (${mandate.outputFocus}).
Search for: ${mandate.groundingFocus}

Requirements:
1. Provide overallDirection: one of "positive", "negative", "neutral", or "mixed"
   CRITICAL: overallDirection MUST be consistent with your holdingImpacts directions. If most holdings have negative direction, overallDirection must be "negative" (bearish). If most are positive, it must be "positive" (bullish). Do NOT say "positive" overall while giving holdings negative directions.
2. Provide overallConfidence: a number between 0 and 1
3. For each affected holding, provide:
   - ticker and name (use ONLY holdings from the portfolio: [${formatHoldingsList(portfolio)}])
   - direction: a number from -1 (very negative) to +1 (very positive)
   - magnitudeScore: a number from 0 (no impact) to 1 (maximum impact) — this is QUALITATIVE, NOT a dollar amount
   - confidence: 0 to 1
   - reasoning: explain the CAUSAL CHAIN — the specific transmission channel from signal to holding. Example: "Higher rates → increased discount rates → compressed equity valuations → tech sector most affected"
4. State 2-3 KEY ASSUMPTIONS your analysis depends on (these will be challenged by the risk team)
5. Cite evidence sources from your search results. Describe each source clearly (e.g. "IMF World Economic Outlook, January 2026", "Reuters: Fed signals further tightening").
6. Do NOT estimate dollar amounts — only qualitative magnitude (0-1). The calibration engine converts these to dollars using real market data.
7. Format your "reasoning" as bullet points (use markdown bullet list "- point"). Each bullet MUST describe a causal mechanism (signal → intermediate effect → holding impact), not just a conclusion.

Respond with valid JSON matching this structure:
{
  "analystType": "${analystType}",
  "overallDirection": "positive" | "negative" | "neutral" | "mixed",
  "overallConfidence": 0.0-1.0,
  "holdingImpacts": [
    {
      "ticker": "string",
      "name": "string",
      "direction": -1.0 to 1.0,
      "magnitudeScore": 0.0-1.0,
      "confidence": 0.0-1.0,
      "reasoning": "string"
    }
  ],
  "keyAssumptions": ["string", "string"],
  "evidenceSources": ["IMF World Economic Outlook, January 2026", "Reuters: Fed signals further tightening"],
  "reasoning": "- Bullet point insight 1\n- Bullet point insight 2\n- Bullet point insight 3"
}`)

  return sections.join('\n')
}

// ── Legacy Prompt Builder (backwards-compatible) ─────────────
export function buildAnalystPrompt(params: {
  readonly analystType: AnalystType
  readonly signal: Signal
  readonly portfolio: Portfolio
  readonly exposureMap: ExposureMap
  readonly riskProfile: InferredRiskProfile
  readonly marketData?: MarketDataBundle
}): string {
  const sharedContext = buildSharedAnalystContext(params)
  return buildAnalystSpecificPrompt(sharedContext, params.analystType, params.portfolio, params.marketData)
}
