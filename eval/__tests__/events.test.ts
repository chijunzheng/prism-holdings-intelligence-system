import { describe, it, expect } from 'vitest'
import { HISTORICAL_EVENTS } from '../events'
import { EVENT_TYPES } from '../types'
import type { HistoricalEvent } from '../types'

describe('Historical Events', () => {
  it('has exactly 25 events', () => {
    expect(HISTORICAL_EVENTS).toHaveLength(25)
  })

  it('all events have required fields with correct types', () => {
    for (const event of HISTORICAL_EVENTS) {
      expect(typeof event.id).toBe('string')
      expect(typeof event.description).toBe('string')
      expect(typeof event.date).toBe('string')
      expect(typeof event.sourceUrl).toBe('string')
      expect(EVENT_TYPES).toContain(event.type)
      expect(typeof event.actualReturns5d).toBe('object')
      expect(event.sourceUrl).toMatch(/^https?:\/\//)
    }
  })

  it('has all 6 event types represented', () => {
    const types = new Set(HISTORICAL_EVENTS.map((e) => e.type))
    expect(types.size).toBe(6)
    expect(types.has('rate_decision')).toBe(true)
    expect(types.has('cpi_surprise')).toBe(true)
    expect(types.has('oil_shock')).toBe(true)
    expect(types.has('banking_stress')).toBe(true)
    expect(types.has('geopolitical')).toBe(true)
    expect(types.has('currency_fx')).toBe(true)
  })

  it('rate decisions are the largest category (8)', () => {
    const rateEvents = HISTORICAL_EVENTS.filter((e) => e.type === 'rate_decision')
    expect(rateEvents).toHaveLength(8)
  })

  it('all events have unique IDs', () => {
    const ids = HISTORICAL_EVENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all events have valid dates in YYYY-MM-DD format', () => {
    for (const event of HISTORICAL_EVENTS) {
      expect(event.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const parsed = new Date(event.date)
      expect(parsed.getTime()).not.toBeNaN()
    }
  })

  it('all events have returns for at least 5 ETFs', () => {
    for (const event of HISTORICAL_EVENTS) {
      const tickerCount = Object.keys(event.actualReturns5d).length
      expect(tickerCount).toBeGreaterThanOrEqual(5)
    }
  })

  it('returns are within realistic bounds (-15% to +15%)', () => {
    for (const event of HISTORICAL_EVENTS) {
      for (const [ticker, ret] of Object.entries(event.actualReturns5d)) {
        expect(Math.abs(ret)).toBeLessThan(0.15)
      }
    }
  })
})
