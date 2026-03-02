import { HISTORICAL_EVENTS } from './events'
import type { QaExample } from './types'

const NEUTRAL_THRESHOLD = 0.005

function directionFromReturn(ret: number): 'positive' | 'negative' | 'neutral' {
  if (ret > NEUTRAL_THRESHOLD) return 'positive'
  if (ret < -NEUTRAL_THRESHOLD) return 'negative'
  return 'neutral'
}

function overallDirection(
  returns5d: Readonly<Record<string, number>>,
): 'positive' | 'negative' | 'neutral' {
  const values = Object.values(returns5d)
  if (values.length === 0) return 'neutral'
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length
  return directionFromReturn(avg)
}

function buildQuery(eventDescription: string, date: string): string {
  return `Event date: ${date}. Event: ${eventDescription} ` +
    'For a reference portfolio holding VFV, XIC, ZAG, ZEB, XEG, and XGD, ' +
    'what is the expected 5-trading-day direction (positive/negative/neutral) per ticker and overall?'
}

export const QA_DATASET_25: readonly QaExample[] = HISTORICAL_EVENTS.map((event) => {
  const perTickerDirection = Object.fromEntries(
    Object.entries(event.actualReturns5d).map(([ticker, ret]) => [ticker, directionFromReturn(ret)]),
  )

  return {
    id: event.id,
    type: event.type,
    date: event.date,
    query: buildQuery(event.description, event.date),
    eventDescription: event.description,
    sourceUrl: event.sourceUrl,
    actualReturns5d: event.actualReturns5d,
    groundedAnswer: {
      overallDirection: overallDirection(event.actualReturns5d),
      perTickerDirection,
      rationale: `Ground truth derived from 5-trading-day realized returns after the event on ${event.date}.`,
      sourceUrl: event.sourceUrl,
    },
  } satisfies QaExample
})
