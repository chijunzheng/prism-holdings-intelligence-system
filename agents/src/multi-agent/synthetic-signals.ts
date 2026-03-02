// Synthetic Signal Factory — creates Signal objects for non-event-driven analysis modes.
// The multi-agent pipeline treats Signal.headline and Signal.description as injected context
// for all analyst prompts, so synthetic signals naturally redirect analyst reasoning.

import { randomUUID } from 'crypto'
import type { Signal, Portfolio, ExposureMap } from '@prism/shared'

type SyntheticMode = 'risk_check' | 'improve_portfolio'

function summarizePortfolio(portfolio: Portfolio, exposureMap: ExposureMap): string {
  const allHoldings = portfolio.accounts.flatMap((a) => a.holdings)
  const totalValue = portfolio.totalValueCad
  const topHoldings = [...allHoldings]
    .sort((a, b) => b.valueCad - a.valueCad)
    .slice(0, 5)
    .map((h) => `${h.ticker} ($${h.valueCad.toLocaleString()}, ${((h.valueCad / totalValue) * 100).toFixed(0)}%)`)

  const exposureCategories = exposureMap.exposures
    .map((e) => `${e.category}: ${e.percentage.toFixed(0)}%`)
    .slice(0, 6)

  return [
    `Total portfolio value: $${totalValue.toLocaleString()} CAD.`,
    `Top holdings: ${topHoldings.join(', ')}.`,
    `Key exposures: ${exposureCategories.join(', ')}.`,
    `Accounts: ${portfolio.accounts.map((a) => a.type).join(', ')}.`,
  ].join(' ')
}

function getAllExposureCategories(exposureMap: ExposureMap): readonly string[] {
  return exposureMap.exposures.map((e) => e.category)
}

export function createSyntheticSignal(
  mode: SyntheticMode,
  exposureMap: ExposureMap,
  portfolio: Portfolio,
): Signal {
  const portfolioSummary = summarizePortfolio(portfolio, exposureMap)
  const affectedExposures = getAllExposureCategories(exposureMap)
  const now = new Date().toISOString()

  if (mode === 'risk_check') {
    return {
      id: `synthetic-risk-check-${randomUUID()}`,
      headline: 'Portfolio Risk Review \u2014 assess concentration, correlation, and tail risk exposure',
      description: [
        'Conduct a comprehensive risk assessment of this portfolio.',
        portfolioSummary,
        'Evaluate: (1) concentration risk in individual positions and sectors,',
        '(2) correlation risk across holdings that may move together in a downturn,',
        '(3) tail risk exposure from leveraged, volatile, or illiquid positions,',
        '(4) missing hedges or defensive positions,',
        '(5) structural vulnerabilities given current market conditions.',
        'Focus on actionable risks the investor should be aware of today.',
      ].join(' '),
      affectedExposures: [...affectedExposures],
      relevanceScore: 0.9,
      urgency: 'medium',
      sentiment: 'mixed',
      temporalClassification: 'structural',
      portfolioSummary,
      sources: [],
      detectedAt: now,
      acknowledged: false,
    }
  }

  // improve_portfolio
  return {
    id: `synthetic-improve-${randomUUID()}`,
    headline: 'Portfolio Optimization Review \u2014 identify diversification gaps and efficiency improvements',
    description: [
      'Evaluate the construction quality of this portfolio and identify improvement opportunities.',
      portfolioSummary,
      'Assess: (1) diversification gaps \u2014 missing asset classes, geographies, or sectors,',
      '(2) concentration that could be reduced without sacrificing returns,',
      '(3) fee optimization \u2014 cheaper alternatives for similar exposure,',
      '(4) rebalancing opportunities given current market conditions,',
      '(5) risk-adjusted return improvements.',
      'Recommend specific changes with estimated impact.',
    ].join(' '),
    affectedExposures: [...affectedExposures],
    relevanceScore: 0.85,
    urgency: 'low',
    sentiment: 'mixed',
    temporalClassification: 'structural',
    portfolioSummary,
    sources: [],
    detectedAt: now,
    acknowledged: false,
  }
}

export function createNaturalLanguageSignal(
  userMessage: string,
  portfolio: Portfolio,
  exposureMap: ExposureMap,
): Signal {
  const portfolioSummary = summarizePortfolio(portfolio, exposureMap)
  const affectedExposures = getAllExposureCategories(exposureMap)
  const now = new Date().toISOString()

  // Extract a headline from the user's message (first 80 chars, cleaned)
  const headline = userMessage.length > 80
    ? userMessage.slice(0, 77) + '...'
    : userMessage

  return {
    id: `synthetic-nlq-${randomUUID()}`,
    headline: `User scenario: ${headline}`,
    description: [
      `The user asked: "${userMessage}"`,
      'Analyze the dollar impact of this scenario on the portfolio below.',
      portfolioSummary,
      'Produce calibrated dollar-impact estimates using real market data.',
      'If the scenario describes a specific market event, analyze its transmission mechanism through affected holdings.',
      'If the scenario is a question about cost/impact, identify the relevant exposures and compute bounded estimates.',
    ].join(' '),
    affectedExposures: [...affectedExposures],
    relevanceScore: 0.85,
    urgency: 'medium',
    sentiment: 'mixed',
    temporalClassification: 'ambiguous',
    portfolioSummary,
    sources: [],
    detectedAt: now,
    acknowledged: false,
  }
}

export function createStockExploreSignal(
  ticker: string,
  portfolio: Portfolio,
  exposureMap: ExposureMap,
): Signal {
  const portfolioSummary = summarizePortfolio(portfolio, exposureMap)
  const affectedExposures = getAllExposureCategories(exposureMap)
  const now = new Date().toISOString()

  return {
    id: `synthetic-explore-${ticker}-${randomUUID()}`,
    headline: `Evaluate ${ticker} as a potential portfolio addition \u2014 assess fit, diversification benefit, and risk`,
    description: [
      `Conduct a thorough evaluation of ${ticker} as a potential addition to this portfolio.`,
      portfolioSummary,
      `Assess: (1) how ${ticker} fits with existing holdings \u2014 overlap vs diversification benefit,`,
      `(2) current valuation and risk profile of ${ticker},`,
      `(3) sector and geographic exposure changes if ${ticker} is added,`,
      '(4) correlation with existing holdings,',
      `(5) recommended position size for ${ticker} given portfolio context.`,
      `Provide a clear buy/wait/skip assessment with supporting evidence.`,
    ].join(' '),
    affectedExposures: [...affectedExposures],
    relevanceScore: 0.8,
    urgency: 'low',
    sentiment: 'mixed',
    temporalClassification: 'structural',
    portfolioSummary,
    sources: [],
    detectedAt: now,
    acknowledged: false,
  }
}
