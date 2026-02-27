import { useMemo } from 'react'
import type { CausalChain } from '@prism/shared'
import { clusterLowImpactAssets, computeGraphPositions, filterChainByDepth } from '../components/graph/graph-utils'
import { applyPruningPipeline, EMBEDDED_DEFAULTS } from '../components/graph/graph-pruning'

interface UseGraphLayoutOptions {
  readonly width: number
  readonly height: number
  readonly expandedDepth: boolean
  readonly clusterAssets: boolean
  readonly mode?: 'canvas' | 'embedded'
}

export function useGraphLayout(
  chain: CausalChain | null,
  options: UseGraphLayoutOptions,
): {
  readonly laidOutChain: CausalChain | null
  readonly positions: ReadonlyMap<string, { x: number; y: number }>
} {
  const laidOutChain = useMemo(() => {
    if (!chain) return null

    let processed = chain
    if (options.mode === 'embedded') {
      processed = applyPruningPipeline(processed, EMBEDDED_DEFAULTS)
    }

    const depthLimited = options.expandedDepth ? processed : filterChainByDepth(processed, 2)
    return options.clusterAssets ? clusterLowImpactAssets(depthLimited) : depthLimited
  }, [chain, options.clusterAssets, options.expandedDepth, options.mode])

  const positions = useMemo(() => {
    if (!laidOutChain) return new Map<string, { x: number; y: number }>()
    return computeGraphPositions(laidOutChain, options.width, options.height)
  }, [laidOutChain, options.height, options.width])

  return { laidOutChain, positions }
}
