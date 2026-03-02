import { describe, it, expect } from 'vitest'
import { mapToRouterIntent, AMBIGUOUS_TICKER_WORDS } from '../query-understanding'

describe('mapToRouterIntent', () => {
  // ── Ambiguous ticker rejection ──────────────────────────────

  it('rejects "MY" as a ticker when used naturally in a sentence', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.8, pipelineMode: 'explore_ticker', extractedTicker: 'MY' },
      'evaluate my current portfolio',
    )
    expect(result.route).toBe('chat')
    expect(result.reasoning).toContain('Rejected ambiguous ticker')
    expect(result.extractedTicker).toBeUndefined()
  })

  it('rejects "ALL" as a ticker when used naturally', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.8, pipelineMode: 'explore_ticker', extractedTicker: 'ALL' },
      'look at all my holdings',
    )
    expect(result.route).toBe('chat')
    expect(result.extractedTicker).toBeUndefined()
  })

  it('rejects "THE" as a ticker when used naturally', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.8, pipelineMode: 'explore_ticker', extractedTicker: 'THE' },
      'what about the market outlook',
    )
    expect(result.route).toBe('chat')
    expect(result.extractedTicker).toBeUndefined()
  })

  it('allows ambiguous ticker when explicitly uppercased in message', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.9, pipelineMode: 'explore_ticker', extractedTicker: 'ALL' },
      'explore ALL',
    )
    expect(result.route).toBe('pipeline')
    expect(result.pipelineMode).toBe('explore_ticker')
    expect(result.extractedTicker).toBe('ALL')
  })

  // ── Real tickers accepted ───────────────────────────────────

  it('accepts AAPL as a real ticker', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.9, pipelineMode: 'explore_ticker', extractedTicker: 'AAPL' },
      'explore AAPL',
    )
    expect(result.route).toBe('pipeline')
    expect(result.pipelineMode).toBe('explore_ticker')
    expect(result.extractedTicker).toBe('AAPL')
  })

  it('accepts TSLA as a real ticker', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.9, pipelineMode: 'explore_ticker', extractedTicker: 'TSLA' },
      'look into TSLA',
    )
    expect(result.extractedTicker).toBe('TSLA')
  })

  it('accepts BRK.B as a real ticker with dot notation', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.9, pipelineMode: 'explore_ticker', extractedTicker: 'BRK.B' },
      'analyze BRK.B',
    )
    expect(result.extractedTicker).toBe('BRK.B')
  })

  it('accepts NVDA as a real ticker', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.85, pipelineMode: 'explore_ticker', extractedTicker: 'NVDA' },
      'what about adding NVDA',
    )
    expect(result.extractedTicker).toBe('NVDA')
  })

  // ── Intent mapping ──────────────────────────────────────────

  it('maps risk_check correctly', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.9, reasoning: 'Risk assessment', pipelineMode: 'risk_check' },
      'evaluate my current portfolio',
    )
    expect(result.route).toBe('pipeline')
    expect(result.pipelineMode).toBe('risk_check')
    expect(result.confidence).toBe(0.9)
  })

  it('maps improve_portfolio correctly', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.85, pipelineMode: 'improve_portfolio' },
      'how can I improve my portfolio',
    )
    expect(result.route).toBe('pipeline')
    expect(result.pipelineMode).toBe('improve_portfolio')
  })

  it('maps chat route correctly', () => {
    const result = mapToRouterIntent(
      { route: 'chat', confidence: 0.95, reasoning: 'Follow-up question' },
      'can you explain the $653 impact?',
    )
    expect(result.route).toBe('chat')
    expect(result.pipelineMode).toBeUndefined()
  })

  it('maps portfolio_review correctly', () => {
    const result = mapToRouterIntent(
      { route: 'portfolio_review', confidence: 0.9, reasoning: 'Full review request' },
      'run a full portfolio review',
    )
    expect(result.route).toBe('portfolio_review')
  })

  it('maps existing_signal correctly', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.9, pipelineMode: 'existing_signal', matchedSignalId: 'sig-123' },
      'analyze the oil situation',
    )
    expect(result.pipelineMode).toBe('existing_signal')
    expect(result.matchedSignalId).toBe('sig-123')
  })

  it('maps new_event correctly', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.8, pipelineMode: 'new_event' },
      'what if rates drop 50bps',
    )
    expect(result.pipelineMode).toBe('new_event')
  })

  // ── Fallback / edge cases ───────────────────────────────────

  it('defaults invalid route to chat', () => {
    const result = mapToRouterIntent(
      { route: 'invalid_route', confidence: 0.5 },
      'some message',
    )
    expect(result.route).toBe('chat')
  })

  it('defaults invalid pipeline mode to new_event', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.5, pipelineMode: 'invalid_mode' },
      'some message',
    )
    expect(result.pipelineMode).toBe('new_event')
  })

  it('caps confidence at 1.0', () => {
    const result = mapToRouterIntent(
      { route: 'chat', confidence: 1.5 },
      'hello',
    )
    expect(result.confidence).toBe(1.0)
  })

  it('defaults missing confidence to 0.5', () => {
    const result = mapToRouterIntent(
      { route: 'chat' },
      'hello',
    )
    expect(result.confidence).toBe(0.5)
  })

  it('does not include extractedTicker for non-explore_ticker modes', () => {
    const result = mapToRouterIntent(
      { route: 'pipeline', confidence: 0.9, pipelineMode: 'risk_check', extractedTicker: 'AAPL' },
      'check my risk for AAPL',
    )
    expect(result.extractedTicker).toBeUndefined()
  })

  // ── AMBIGUOUS_TICKER_WORDS set coverage ─────────────────────

  it('contains common false-positive words', () => {
    expect(AMBIGUOUS_TICKER_WORDS.has('MY')).toBe(true)
    expect(AMBIGUOUS_TICKER_WORDS.has('ALL')).toBe(true)
    expect(AMBIGUOUS_TICKER_WORDS.has('THE')).toBe(true)
    expect(AMBIGUOUS_TICKER_WORDS.has('FOR')).toBe(true)
    expect(AMBIGUOUS_TICKER_WORDS.has('REAL')).toBe(true)
    expect(AMBIGUOUS_TICKER_WORDS.has('GOOD')).toBe(true)
    expect(AMBIGUOUS_TICKER_WORDS.has('OPEN')).toBe(true)
  })

  it('does not contain real ticker symbols', () => {
    expect(AMBIGUOUS_TICKER_WORDS.has('AAPL')).toBe(false)
    expect(AMBIGUOUS_TICKER_WORDS.has('TSLA')).toBe(false)
    expect(AMBIGUOUS_TICKER_WORDS.has('NVDA')).toBe(false)
    expect(AMBIGUOUS_TICKER_WORDS.has('GOOG')).toBe(false)
    expect(AMBIGUOUS_TICKER_WORDS.has('MSFT')).toBe(false)
  })
})
