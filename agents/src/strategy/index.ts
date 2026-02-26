import type {
  StrategyDraft,
  StrategyDraftRequest,
  StrategyEvaluateRequest,
  StrategyEvaluation,
} from '@prism/shared'
import type { AgentConfig, AgentResult } from '../types'
import type { PipelineContext } from '../orchestrator/index'
import { buildStrategyDraft, evaluateStrategyScenario } from '../strategy-simulator/index'

export const config: AgentConfig = {
  name: 'strategy',
  description: 'Builds and evaluates closed-loop mitigation strategy drafts',
  usesLlm: false,
}

export async function runStrategyDraft(
  ctx: PipelineContext,
  request: StrategyDraftRequest,
): Promise<AgentResult<StrategyDraft>> {
  return buildStrategyDraft(ctx, request)
}

export async function runStrategyEvaluation(
  ctx: PipelineContext,
  request: StrategyEvaluateRequest,
): Promise<AgentResult<StrategyEvaluation>> {
  return evaluateStrategyScenario(ctx, request)
}
