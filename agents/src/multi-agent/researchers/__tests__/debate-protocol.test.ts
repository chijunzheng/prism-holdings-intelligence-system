import { describe, it, expect } from 'vitest'
import { hasConverged } from '../debate-protocol'
import type { DebateArgument } from '@prism/shared'

function makeArg(overrides: Partial<DebateArgument> = {}): DebateArgument {
  return {
    position: 'negative',
    round: 1,
    keyPoints: ['Bond prices will fall'],
    evidenceCited: ['BOC statement'],
    rebuttalPoints: [],
    concessions: [],
    ...overrides,
  }
}

describe('hasConverged', () => {
  it('returns false when no arguments exist', () => {
    expect(hasConverged([], [])).toBe(false)
  })

  it('returns true when both sides agree on direction', () => {
    const bull = [makeArg({ position: 'negative' })]
    const bear = [makeArg({ position: 'negative' })]

    expect(hasConverged(bull, bear)).toBe(true)
  })

  it('returns false when directions disagree and no concessions', () => {
    const bull = [makeArg({ position: 'negative' })]
    const bear = [makeArg({ position: 'neutral' })]

    expect(hasConverged(bull, bear)).toBe(false)
  })

  it('returns true when both sides have made concessions', () => {
    const bull = [makeArg({
      position: 'negative',
      concessions: ['Impact may be smaller than initially estimated'],
    })]
    const bear = [makeArg({
      position: 'neutral',
      concessions: ['Forward guidance risk is real'],
    })]

    expect(hasConverged(bull, bear)).toBe(true)
  })

  it('returns false when only one side concedes', () => {
    const bull = [makeArg({
      position: 'negative',
      concessions: ['Impact may be smaller'],
    })]
    const bear = [makeArg({
      position: 'neutral',
      concessions: [],
    })]

    expect(hasConverged(bull, bear)).toBe(false)
  })

  it('uses last argument for multi-round debates', () => {
    const bull = [
      makeArg({ position: 'negative', round: 1, concessions: [] }),
      makeArg({ position: 'negative', round: 2, concessions: ['Magnitude lower'] }),
    ]
    const bear = [
      makeArg({ position: 'neutral', round: 1, concessions: [] }),
      makeArg({ position: 'neutral', round: 2, concessions: ['Direction risk valid'] }),
    ]

    // Last round has concessions on both sides
    expect(hasConverged(bull, bear)).toBe(true)
  })
})
