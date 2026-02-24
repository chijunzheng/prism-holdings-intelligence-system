import { z } from 'zod'
import { TemporalClassification } from '../constants/temporal'

// ── Causal Chain Node ──────────────────────────────────────
// Event → Mechanism → Sector → Asset progression
export const CausalChainNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['event', 'mechanism', 'sector', 'asset']),
  label: z.string(),
  description: z.string(),
  temporalClassification: TemporalClassification.optional(),
  /** 0-1 confidence score */
  confidence: z.number().min(0).max(1),
  /** Dollar impact on user's portfolio — only on asset nodes */
  dollarImpact: z.number().optional(),
  /** Percentage impact — only on asset nodes */
  percentageImpact: z.number().optional(),
  metadata: z.record(z.unknown()),
})
export type CausalChainNode = z.infer<typeof CausalChainNodeSchema>

// ── Causal Chain Edge ──────────────────────────────────────
export const CausalChainEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  /** 0-1 magnitude (rendered as edge thickness) */
  magnitude: z.number().min(0).max(1),
  /** Positive = green edge, Negative = red edge */
  direction: z.enum(['positive', 'negative', 'ambiguous']),
  /** 0-1 confidence (rendered as edge opacity) */
  confidence: z.number().min(0).max(1),
  /** Human-readable causal explanation */
  mechanism: z.string(),
})
export type CausalChainEdge = z.infer<typeof CausalChainEdgeSchema>

// ── Full Causal Chain ──────────────────────────────────────
export const CausalChainSchema = z.object({
  id: z.string(),
  signalId: z.string(),
  generatedAt: z.string().datetime(),
  nodes: z.array(CausalChainNodeSchema).readonly(),
  edges: z.array(CausalChainEdgeSchema).readonly(),
  summary: z.string(),
  /** Regulatory disclaimer (PRD Section 9) */
  disclaimer: z.string(),
  /** Chains beyond 3 hops must be flagged per critical constraints */
  maxHops: z.number().int().positive(),
  isSpeculative: z.boolean(),
})
export type CausalChain = z.infer<typeof CausalChainSchema>
