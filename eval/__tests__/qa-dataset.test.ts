import { describe, it, expect } from 'vitest'
import { QA_DATASET_25 } from '../qa-dataset'
import { EVENT_TYPES } from '../types'

describe('QA_DATASET_25', () => {
  it('has exactly 25 examples', () => {
    expect(QA_DATASET_25).toHaveLength(25)
  })

  it('contains valid query and grounded answer fields', () => {
    for (const item of QA_DATASET_25) {
      expect(item.query.length).toBeGreaterThan(20)
      expect(item.eventDescription.length).toBeGreaterThan(10)
      expect(EVENT_TYPES).toContain(item.type)
      expect(item.groundedAnswer.sourceUrl).toMatch(/^https?:\/\//)
      expect(['positive', 'negative', 'neutral']).toContain(item.groundedAnswer.overallDirection)
    }
  })

  it('perTickerDirection keys match actualReturns keys', () => {
    for (const item of QA_DATASET_25) {
      const actualKeys = Object.keys(item.actualReturns5d).sort()
      const directionKeys = Object.keys(item.groundedAnswer.perTickerDirection).sort()
      expect(directionKeys).toEqual(actualKeys)
    }
  })
})
