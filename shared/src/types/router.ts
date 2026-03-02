import { z } from 'zod'

// ── Route Types ──────────────────────────────────────────────

export const RouteType = z.enum(['chat', 'pipeline', 'portfolio_review'])
export type RouteType = z.infer<typeof RouteType>

export const PipelineMode = z.enum([
  'existing_signal',
  'risk_check',
  'improve_portfolio',
  'explore_ticker',
  'new_event',
])
export type PipelineMode = z.infer<typeof PipelineMode>

// ── Router Intent ────────────────────────────────────────────

export const RouterIntentSchema = z.object({
  route: RouteType,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  pipelineMode: PipelineMode.optional(),
  extractedTicker: z.string().optional(),
  matchedSignalId: z.string().optional(),
  extractedAssertions: z.array(z.string()).optional(),
  introText: z.string().optional(),
})
export type RouterIntent = z.infer<typeof RouterIntentSchema>

// ── Router Result (returned to server) ───────────────────────

export interface RouterResult {
  readonly intent: RouterIntent
  readonly personalContextPrompt: string
}

// ── Route Decision SSE Event ─────────────────────────────────

export interface RouteDecisionEvent {
  readonly route: RouteType
  readonly pipelineMode?: PipelineMode
  readonly confidence: number
  readonly introText?: string
}
