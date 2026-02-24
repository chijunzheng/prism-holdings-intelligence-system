import { CausalChainSchema, type CausalChain } from '@prism/shared'
import { MAX_NON_SPECULATIVE_HOPS } from '@prism/shared'
import type { ZodError } from 'zod'

interface ValidationResult {
  readonly success: boolean
  readonly chain?: CausalChain
  readonly errors?: ReadonlyArray<string>
}

/**
 * Validates and cleans a raw causal chain response.
 * Returns typed CausalChain or detailed error messages for retry.
 */
export function validateCausalChain(responseText: string): ValidationResult {
  // Extract JSON from response (may have markdown fences)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { success: false, errors: ['Response did not contain a JSON object'] }
  }

  let raw: unknown
  try {
    raw = JSON.parse(jsonMatch[0])
  } catch {
    return { success: false, errors: ['Response JSON is malformed'] }
  }

  try {
    const chain = CausalChainSchema.parse(raw)

    // Post-validation: compute maxHops and speculative flag
    const hops = computeMaxHops(chain)
    const enriched: CausalChain = {
      ...chain,
      maxHops: hops,
      isSpeculative: hops > MAX_NON_SPECULATIVE_HOPS,
    }

    return { success: true, chain: enriched }
  } catch (error) {
    const zodError = error as ZodError
    const errors = zodError.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    )
    return { success: false, errors }
  }
}

/**
 * Computes the longest path (in hops) from any event node to any asset node.
 */
function computeMaxHops(chain: CausalChain): number {
  const eventNodes = chain.nodes.filter((n) => n.type === 'event').map((n) => n.id)
  const adjacency = new Map<string, string[]>()

  for (const edge of chain.edges) {
    const targets = adjacency.get(edge.source) ?? []
    adjacency.set(edge.source, [...targets, edge.target])
  }

  let maxHops = 0

  function dfs(nodeId: string, depth: number) {
    maxHops = Math.max(maxHops, depth)
    const neighbors = adjacency.get(nodeId) ?? []
    for (const neighbor of neighbors) {
      dfs(neighbor, depth + 1)
    }
  }

  for (const eventId of eventNodes) {
    dfs(eventId, 0)
  }

  return maxHops
}
