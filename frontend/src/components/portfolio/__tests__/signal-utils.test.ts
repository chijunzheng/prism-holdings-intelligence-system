import { describe, it, expect } from 'vitest'
import type { Signal } from '@prism/shared'
import {
  getMateriality,
  buildSignalGraphRoute,
  getOverflowCount,
  getVisibleSignals,
  getBadgeVariant,
  markSignalViewed,
  readViewedSignalIds,
  viewedSignalsStorageKey,
} from '../signal-utils'

function makeSignal(overrides: Partial<Signal>): Signal {
  return {
    id: overrides.id ?? 'sig-default',
    headline: overrides.headline ?? 'Signal',
    description: overrides.description ?? 'Description',
    affectedExposures: overrides.affectedExposures ?? ['Canadian Financials'],
    relevanceScore: overrides.relevanceScore ?? 0.5,
    urgency: overrides.urgency ?? 'medium',
    sentiment: overrides.sentiment ?? 'mixed',
    temporalClassification: overrides.temporalClassification ?? 'ambiguous',
    sources: overrides.sources ?? [{ title: 'Source', url: 'https://example.com' }],
    detectedAt: overrides.detectedAt ?? '2026-02-24T12:00:00.000Z',
    acknowledged: overrides.acknowledged ?? false,
  }
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function makeMemoryStorage(): StorageLike {
  const data = new Map<string, string>()
  return {
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null
    },
    setItem(key: string, value: string) {
      data.set(key, value)
    },
  }
}

describe('signal-utils', () => {
  it('enforces max 3 visible signals and computes overflow', () => {
    const signals = [
      makeSignal({ id: 'a', urgency: 'low', relevanceScore: 0.55 }),
      makeSignal({ id: 'b', urgency: 'high', relevanceScore: 0.8 }),
      makeSignal({ id: 'c', urgency: 'critical', relevanceScore: 0.9 }),
      makeSignal({ id: 'd', urgency: 'medium', relevanceScore: 0.7 }),
    ]

    const visible = getVisibleSignals(signals)
    expect(visible).toHaveLength(3)
    expect(visible.map((s) => s.id)).toEqual(['c', 'b', 'd'])
    expect(getOverflowCount(signals)).toBe(1)
  })

  it('maps materiality from urgency + relevance', () => {
    expect(getMateriality(makeSignal({ urgency: 'critical', relevanceScore: 0.6 }))).toBe('high')
    expect(getMateriality(makeSignal({ urgency: 'medium', relevanceScore: 0.75 }))).toBe('medium')
    expect(getMateriality(makeSignal({ urgency: 'low', relevanceScore: 0.5 }))).toBe('low')
  })

  it('maps temporal classification to badge variant', () => {
    expect(getBadgeVariant('transient')).toBe('transient')
    expect(getBadgeVariant('structural')).toBe('structural')
    expect(getBadgeVariant('ambiguous')).toBe('ambiguous')
  })

  it('builds graph route with encoded signal id', () => {
    expect(buildSignalGraphRoute('sig-with spaces')).toBe('/signals/sig-with%20spaces')
  })

  it('persists viewed-state using storage key scoped by user', () => {
    const storage = makeMemoryStorage()
    const userId = 'sarah-01'

    expect(readViewedSignalIds(userId, storage)).toEqual(new Set())
    markSignalViewed(userId, 'sig-1', storage)
    markSignalViewed(userId, 'sig-2', storage)

    expect(readViewedSignalIds(userId, storage)).toEqual(new Set(['sig-1', 'sig-2']))
    expect(viewedSignalsStorageKey(userId)).toBe('prism.viewed.signals:sarah-01')
  })
})
