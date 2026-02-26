import {
  StrategyDraftRequestSchema,
  StrategyEvaluateRequestSchema,
  type StrategyDraftRequest,
  type StrategyEvaluateRequest,
} from '@prism/shared'
import type { PipelineContext } from '@prism/agents/src/orchestrator/index'
import { runStrategyDraft, runStrategyEvaluation } from '@prism/agents/src/strategy/index'

export function parseStrategyDraftRequest(input: unknown):
  | { readonly ok: true; readonly data: StrategyDraftRequest }
  | { readonly ok: false; readonly error: string } {
  const parsed = StrategyDraftRequestSchema.safeParse(input ?? {})
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid strategy draft request',
    }
  }
  return { ok: true, data: parsed.data }
}

export function parseStrategyEvaluateRequest(input: unknown):
  | { readonly ok: true; readonly data: StrategyEvaluateRequest }
  | { readonly ok: false; readonly error: string } {
  const parsed = StrategyEvaluateRequestSchema.safeParse(input ?? {})
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid strategy evaluation request',
    }
  }
  return { ok: true, data: parsed.data }
}

export async function createStrategyDraft(ctx: PipelineContext, request: StrategyDraftRequest) {
  return runStrategyDraft(ctx, request)
}

export async function evaluateStrategy(ctx: PipelineContext, request: StrategyEvaluateRequest) {
  return runStrategyEvaluation(ctx, request)
}
