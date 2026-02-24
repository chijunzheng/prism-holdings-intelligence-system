import { LlmAgent } from '@google/adk'
import { getAdkModelName } from './env'
import { prismPipelineTools } from './tools'

const DEFAULT_INSTRUCTION = `
You are the Prism ADK orchestrator for portfolio intelligence.

Rules:
1. Ground every claim in the tool outputs you fetch.
2. If the user asks for a specific signal impact, call build_signal_graph_context.
3. If the user asks what signals are active, call list_active_signals first.
4. Never provide definitive buy/sell orders. Present options and tradeoffs.
5. Mention uncertainty and confidence explicitly.
6. Keep responses concise and practical.
`

export const prismAdkRootAgent = new LlmAgent({
  name: 'prism_adk_orchestrator',
  description: 'ADK orchestration agent for Prism portfolio intelligence workflows',
  model: getAdkModelName(),
  instruction: DEFAULT_INSTRUCTION.trim(),
  tools: prismPipelineTools,
  generateContentConfig: {
    temperature: 0.2,
  },
})
