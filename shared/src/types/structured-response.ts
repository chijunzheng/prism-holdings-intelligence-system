import { z } from 'zod'

// ── Sentiment (reused across sections) ─────────────────────
export const Sentiment = z.enum(['positive', 'negative', 'mixed', 'neutral'])
export type Sentiment = z.infer<typeof Sentiment>

// ── Follow-Up Suggestions ──────────────────────────────────
export const FollowUpSuggestionSchema = z.object({
  text: z.string(),
  priority: z.enum(['primary', 'secondary']),
})
export type FollowUpSuggestion = z.infer<typeof FollowUpSuggestionSchema>

// ── Stat Pill (used in summary + metric_row) ───────────────
export const StatPillSchema = z.object({
  label: z.string(),
  value: z.string(),
  sentiment: Sentiment.optional(),
})
export type StatPill = z.infer<typeof StatPillSchema>

// ── Section Types ──────────────────────────────────────────

export const SummarySectionSchema = z.object({
  type: z.literal('summary'),
  sentiment: Sentiment,
  headline: z.string(),
  body: z.string().optional(),
  stats: z.array(StatPillSchema).optional(),
})
export type SummarySection = z.infer<typeof SummarySectionSchema>

export const SignalItemSectionSchema = z.object({
  type: z.literal('signal_item'),
  sentiment: Sentiment,
  headline: z.string(),
  body: z.string(),
  tickers: z.array(z.string()).optional(),
  exposureAmount: z.string().optional(),
  signalId: z.string().optional(),
  sourceTitle: z.string().optional(),
  sourceUrl: z.string().optional(),
})
export type SignalItemSection = z.infer<typeof SignalItemSectionSchema>

export const HoldingItemSectionSchema = z.object({
  type: z.literal('holding_item'),
  ticker: z.string(),
  name: z.string(),
  value: z.string(),
  detail: z.string().optional(),
  relatedSignals: z.array(z.string()).optional(),
})
export type HoldingItemSection = z.infer<typeof HoldingItemSectionSchema>

export const TextSectionSchema = z.object({
  type: z.literal('text'),
  body: z.string(),
})
export type TextSection = z.infer<typeof TextSectionSchema>

export const InsightSectionSchema = z.object({
  type: z.literal('insight'),
  icon: z.enum(['tip', 'warning', 'info', 'positive']),
  title: z.string().optional(),
  body: z.string(),
  actionLabel: z.string().optional(),
  actionPrompt: z.string().optional(),
})
export type InsightSection = z.infer<typeof InsightSectionSchema>

export const MetricRowSectionSchema = z.object({
  type: z.literal('metric_row'),
  metrics: z.array(StatPillSchema),
})
export type MetricRowSection = z.infer<typeof MetricRowSectionSchema>

// Group uses z.lazy() for recursive nesting
export const GroupSectionSchema: z.ZodType<{
  type: 'group'
  title: string
  defaultOpen: boolean
  sections: readonly StructuredSection[]
}> = z.object({
  type: z.literal('group'),
  title: z.string(),
  defaultOpen: z.boolean(),
  sections: z.lazy(() => StructuredSectionSchema.array()),
})
export type GroupSection = z.infer<typeof GroupSectionSchema>

// ── Union of all section types ─────────────────────────────
export const StructuredSectionSchema: z.ZodType<StructuredSection> = z.discriminatedUnion('type', [
  SummarySectionSchema,
  SignalItemSectionSchema,
  HoldingItemSectionSchema,
  TextSectionSchema,
  InsightSectionSchema,
  MetricRowSectionSchema,
]) .or(GroupSectionSchema) as z.ZodType<StructuredSection>

export type StructuredSection =
  | SummarySection
  | SignalItemSection
  | HoldingItemSection
  | TextSection
  | InsightSection
  | MetricRowSection
  | GroupSection

// ── Root Data Type ─────────────────────────────────────────
export const StructuredResponseDataSchema = z.object({
  sections: z.array(StructuredSectionSchema),
  followUps: z.array(FollowUpSuggestionSchema).optional(),
})
export type StructuredResponseData = z.infer<typeof StructuredResponseDataSchema>
