import { z } from 'zod'

export const TemporalClassification = z.enum(['transient', 'structural', 'ambiguous'])
export type TemporalClassification = z.infer<typeof TemporalClassification>

/** Thresholds for temporal classification confidence */
export const TEMPORAL_THRESHOLDS = {
  /** Below this confidence, classify as ambiguous */
  AMBIGUOUS_CEILING: 0.5,
  /** Above this confidence, allow structural/transient classification */
  CONFIDENT_FLOOR: 0.7,
} as const
