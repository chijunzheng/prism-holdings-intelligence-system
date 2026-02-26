import { useMemo } from 'react'
import type { CausalChain } from '@prism/shared'
import { clusterLowImpactAssets, computeGraphPositions, filterChainByDepth } from '../components/graph/graph-utils'

interface UseGraphLayoutOptions {
  readonly width: number
  readonly height: number
  readonly expandedDepth: boolean
  readonly clusterAssets: boolean
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
    const depthLimited = options.expandedDepth ? chain : filterChainByDepth(chain, 2)
    return options.clusterAssets ? clusterLowImpactAssets(depthLimited) : depthLimited
  }, [chain, options.clusterAssets, options.expandedDepth])

  const positions = useMemo(() => {
    if (!laidOutChain) return new Map<string, { x: number; y: number }>()
    return computeGraphPositions(laidOutChain, options.width, options.height)
  }, [laidOutChain, options.height, options.width])

  return { laidOutChain, positions }
}
