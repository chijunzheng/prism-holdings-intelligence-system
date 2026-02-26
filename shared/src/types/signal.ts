import { z } from 'zod'
import { TemporalClassification } from '../constants/temporal'

// ── Signal Urgency ─────────────────────────────────────────
export const SignalUrgency = z.enum(['low', 'medium', 'high', 'critical'])
export type SignalUrgency = z.infer<typeof SignalUrgency>

// ── Signal Source Citation ─────────────────────────────────
export const SourceCitationSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  publishedAt: z.string().datetime().optional(),
  publisher: z.string().optional(),
})
export type SourceCitation = z.infer<typeof SourceCitationSchema>

// ── Signal (output of Signal Monitor) ──────────────────────
export const SignalSchema = z.object({
  id: z.string(),
  /** The market event headline */
  headline: z.string(),
  /** Detailed description of what happened */
  description: z.string(),
  /** Which exposure categories this signal affects */
  affectedExposures: z.array(z.string()).readonly(),
  /** Direct relevance to user's portfolio (0-1) */
  relevanceScore: z.number().min(0).max(1),
  urgency: SignalUrgency,
  /** Whether this signal is positive, negative, or mixed for the user's portfolio */
  sentiment: z.enum(['positive', 'negative', 'mixed']).default('negative'),
  temporalClassification: TemporalClassification,
  /** One-sentence personalized summary of how this event affects the user's specific holdings */
  portfolioSummary: z.string().optional(),
  /** Sources from Gemini Search grounding */
  sources: z.array(SourceCitationSchema).readonly(),
  detectedAt: z.string().datetime(),
  /** Whether user has seen this signal */
  acknowledged: z.boolean(),
})
export type Signal = z.infer<typeof SignalSchema>
