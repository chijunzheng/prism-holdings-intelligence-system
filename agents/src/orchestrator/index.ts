import type { AgentConfig } from '../types'

export const config: AgentConfig = {
  name: 'orchestrator',
  description: 'Coordinates agent execution and routes user what-if scenarios',
  usesLlm: false,
}

/** Stub — implemented in Feature 12 */
export async function orchestrate(): Promise<void> {
  throw new Error('Not implemented — see Feature 12')
}
