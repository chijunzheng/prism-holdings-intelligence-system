/**
 * Common agent interface. Each agent is an async function that takes
 * typed input and returns typed output. This mirrors Google ADK's
 * agent pattern while staying pure TypeScript for the prototype.
 */
export interface AgentConfig {
  readonly name: string
  readonly description: string
  readonly usesLlm: boolean
}

export interface AgentResult<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
  readonly durationMs: number
}
