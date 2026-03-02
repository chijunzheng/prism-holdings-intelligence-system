import { describe, it, expect } from 'vitest'
import { getMissingCompletionFields } from '../index'

describe('getMissingCompletionFields', () => {
  it('returns empty list when all required fields are present', () => {
    const completeState = {
      fundManagerVerdict: {},
      researchBrief: {},
      riskProfile: {},
      analystAssessments: [],
      debateResolution: {},
      riskChallenge: {},
      magnitudeValidation: {},
      stressTest: {},
      judgeVerdict: {},
    } as Record<string, unknown>

    expect(getMissingCompletionFields(completeState)).toEqual([])
  })

  it('returns all missing required fields', () => {
    const incompleteState = {
      analystAssessments: null,
      stressTest: {},
    } as Record<string, unknown>

    expect(getMissingCompletionFields(incompleteState)).toEqual([
      'fundManagerVerdict',
      'researchBrief',
      'riskProfile',
      'analystAssessments',
      'debateResolution',
      'riskChallenge',
      'magnitudeValidation',
      'judgeVerdict',
    ])
  })
})
