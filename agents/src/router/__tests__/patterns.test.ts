import { describe, it, expect } from 'vitest'
import { classifyByPatternWithoutSignals } from '../patterns'

describe('classifyByPatternWithoutSignals', () => {
  // ── Greetings → chat ───────────────────────────────────────

  it('routes greetings to chat', () => {
    const result = classifyByPatternWithoutSignals('Hello')
    expect(result).not.toBeNull()
    expect(result!.route).toBe('chat')
    expect(result!.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('routes "thank you" to chat', () => {
    const result = classifyByPatternWithoutSignals('Thank you')
    expect(result).not.toBeNull()
    expect(result!.route).toBe('chat')
  })

  it('routes "can you help me understand bonds" to chat', () => {
    const result = classifyByPatternWithoutSignals('Can you help me understand bonds?')
    expect(result).not.toBeNull()
    expect(result!.route).toBe('chat')
  })

  // ── Ticker extraction removed (handled by query understanding agent) ──

  it('returns null for "explore AAPL" (handled by query understanding agent)', () => {
    expect(classifyByPatternWithoutSignals('Explore AAPL')).toBeNull()
  })

  it('returns null for "tell me about TSLA" (handled by query understanding agent)', () => {
    expect(classifyByPatternWithoutSignals('Tell me about TSLA')).toBeNull()
  })

  it('returns null for "evaluate my portfolio" (no false ticker match)', () => {
    expect(classifyByPatternWithoutSignals('evaluate my current portfolio')).toBeNull()
  })

  // ── Falls through to query understanding for everything else ──

  it('returns null for dollar-impact questions', () => {
    expect(classifyByPatternWithoutSignals('How much would a rate hike cost me?')).toBeNull()
  })

  it('returns null for portfolio review requests', () => {
    expect(classifyByPatternWithoutSignals('Run a full portfolio review')).toBeNull()
  })

  it('returns null for risk check requests', () => {
    expect(classifyByPatternWithoutSignals('What are my biggest risks?')).toBeNull()
  })

  it('returns null for improvement requests', () => {
    expect(classifyByPatternWithoutSignals('How can I improve my portfolio?')).toBeNull()
  })

  it('returns null for ambiguous messages', () => {
    expect(classifyByPatternWithoutSignals('I think tech stocks might drop soon')).toBeNull()
  })

  // ── Edge cases ─────────────────────────────────────────────

  it('returns null for empty string', () => {
    expect(classifyByPatternWithoutSignals('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(classifyByPatternWithoutSignals('   ')).toBeNull()
  })
})
