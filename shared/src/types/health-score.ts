import { z } from 'zod'

// ── Letter Grades ────────────────────────────────────────
export const LetterGrade = z.enum([
  'A+', 'A', 'A-',
  'B+', 'B', 'B-',
  'C+', 'C', 'C-',
  'D+', 'D', 'D-',
  'F',
])
export type LetterGrade = z.infer<typeof LetterGrade>

// ── Sub-Score Dimension ──────────────────────────────────
export const SubScoreSchema = z.object({
  /** Dimension name */
  dimension: z.enum(['diversification', 'concentration', 'overlap', 'freshness']),
  /** Normalized score 0-100 */
  score: z.number().min(0).max(100),
  /** One-line explanation for the user */
  insight: z.string(),
})
export type SubScore = z.infer<typeof SubScoreSchema>

// ── Portfolio Health Score ────────────────────────────────
export const HealthScoreSchema = z.object({
  /** Composite score 0-100 */
  composite: z.number().min(0).max(100),
  /** Letter grade mapped from composite */
  grade: LetterGrade,
  /** Individual dimension scores */
  subScores: z.object({
    diversification: SubScoreSchema,
    concentration: SubScoreSchema,
    overlap: SubScoreSchema,
    freshness: SubScoreSchema,
  }),
  /** ISO datetime of when this score was computed */
  computedAt: z.string().datetime(),
})
export type HealthScore = z.infer<typeof HealthScoreSchema>
