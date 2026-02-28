import { describe, expect, it } from 'vitest'
import type { ExposureMap } from '@prism/shared'
import {
  buildFollowUpQueries,
  buildNavigationChips,
  buildWelcomeContextCard,
  getAskPrismComposerPlaceholder,
} from '../ask-prism-drawer-utils'

function makeExposureMap(): ExposureMap {
  return {
    portfolioId: 'portfolio-1',
    generatedAt: '2026-02-27T10:00:00.000Z',
    exposures: [
      {
        category: 'Canadian Financials',
        percentage: 22.3,
        valueCad: 22300,
        contributingHoldings: [{ ticker: 'XFN', contribution: 50 }],
      },
      {
        category: 'US Technology',
        percentage: 16.5,
        valueCad: 16500,
        contributingHoldings: [{ ticker: 'QQQ', contribution: 60 }],
      },
      {
        category: 'Canadian Energy',
        percentage: 14.3,
        valueCad: 14300,
        contributingHoldings: [{ ticker: 'XEG', contribution: 40 }],
      },
    ],
    overlaps: [
      {
        assetName: 'Royal Bank of Canada',
        assetTicker: 'RY',
        totalPercentage: 8,
        sources: [{ fundTicker: 'XFN', weightInFund: 10 }],
      },
    ],
    warnings: [
      {
        category: 'Canadian Financials',
        percentage: 22.3,
        severity: 'high',
        message: 'Concentration elevated',
      },
    ],
    dataFreshness: {
      allFresh: true,
      staleFunds: [],
    },
  }
}

describe('ask-prism-drawer-utils', () => {
  it('uses node-specific placeholder only for graph-node entry', () => {
    expect(getAskPrismComposerPlaceholder('portfolio')).toBe(
      'Ask about your holdings, overlaps, or concentration...',
    )
    expect(
      getAskPrismComposerPlaceholder('portfolio', {
        entryType: 'graph_node',
        signalId: 'sig-1',
        nodeId: 'node-1',
        nodeLabel: 'Inflation',
      }),
    ).toBe('Ask how this node impacts your portfolio...')
  })

  it('builds portfolio context card from live exposure map', () => {
    const card = buildWelcomeContextCard({
      page: 'portfolio',
      exposureMap: makeExposureMap(),
    })

    expect(card.title).toBe('Portfolio Context')
    expect(card.badges.map((badge) => badge.label)).toContain('Canadian Financials: 22.3%')
    expect(card.badges.map((badge) => badge.label)).toContain('1 warning')
    expect(card.badges.find((badge) => badge.label === '1 warning')?.warning).toBe(true)
  })

  it('filters navigation chips that point to the current page route', () => {
    const chips = buildNavigationChips('portfolio', undefined, 'show my portfolio concentration and overlaps')

    expect(chips.some((chip) => chip.to === '/portfolio')).toBe(false)
    expect(chips.some((chip) => chip.to === '/signals')).toBe(true)
  })

  it('builds dynamic follow-up queries from signal and risk context', () => {
    const signalFollowUps = buildFollowUpQueries(
      'signals_overview',
      'which signal is driving downside and what should I monitor',
    )
    const exposureFollowUps = buildFollowUpQueries(
      'portfolio',
      'am I over concentrated in sector overlap risk',
      'AAPL',
    )

    expect(signalFollowUps).not.toEqual(exposureFollowUps)
    expect(signalFollowUps.length).toBeGreaterThan(0)
    expect(exposureFollowUps.some((query) => query.includes('AAPL'))).toBe(true)
  })
})
