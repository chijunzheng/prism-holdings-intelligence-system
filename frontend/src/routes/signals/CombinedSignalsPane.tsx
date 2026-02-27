import { useCallback, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { CausalChainNode } from '@prism/shared'
import { usePortfolioNetImpact } from '../../hooks/usePortfolioNetImpact'
import { CausalGraph } from '../../components/graph/CausalGraph'
import { SignalContributionsTable } from '../../components/signal/SignalContributionsTable'
import { NodeDetailSheet } from '../../components/signal/NodeDetailSheet'
import type { SignalsOutletContext } from './SignalsLayout'

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : '+'
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

export function CombinedSignalsPane() {
  const { userId, signals } = useOutletContext<SignalsOutletContext>()
  const { data: netImpact, loading, error } = usePortfolioNetImpact(userId)
  const navigate = useNavigate()

  const [selectedNode, setSelectedNode] = useState<CausalChainNode | null>(null)

  const handleNodeSelect = useCallback((node: CausalChainNode) => {
    setSelectedNode(node)
  }, [])

  const handleCloseSheet = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const handleSelectSignal = useCallback((signalId: string) => {
    navigate(`/signals/${encodeURIComponent(signalId)}`)
  }, [navigate])

  if (loading) {
    return (
      <>
        <div className="signals-center">
          <div className="signals-center__loading">Loading combined impact analysis...</div>
        </div>
        <aside className="signal-sidebar" />
      </>
    )
  }

  if (error || !netImpact) {
    return (
      <>
        <div className="signals-center">
          <div className="signals-center__loading">
            {error ? `Failed to load net impact: ${error}` : 'No impact data available.'}
          </div>
        </div>
        <aside className="signal-sidebar" />
      </>
    )
  }

  const netOneMonth = netImpact.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact
  const isNegative = netOneMonth < 0

  return (
    <>
      {/* Center pane: aggregated graph + contributions table */}
      <div className="signals-center">
        <div className="signals-center__graph">
          <CausalGraph
            chain={netImpact.chain}
            temporalAnalysis={netImpact.temporalAnalysis}
            horizon="oneMonth"
            counterfactualEnabled={false}
            expandedDepth={false}
            selectedNodeId={selectedNode?.id ?? null}
            onNodeSelect={handleNodeSelect}
            mode="canvas"
          />
        </div>

        <div className="signals-center__below">
          <div className="combined-pane__summary">
            <div>
              <p className="combined-pane__net-label">Net Portfolio Impact (1M)</p>
              <p className={`combined-pane__net-value ${isNegative ? 'combined-pane__net-value--negative' : 'combined-pane__net-value--positive'}`}>
                {formatDollar(netOneMonth)}
              </p>
            </div>
            <span className="combined-pane__signal-count">
              {netImpact.includedSignalCount} of {netImpact.signalUniverseCount} signals included
            </span>
          </div>

          <SignalContributionsTable
            contributions={netImpact.signalContributions}
            onSelectSignal={handleSelectSignal}
          />
        </div>
      </div>

      {/* Right sidebar: net impact summary */}
      <aside className="signal-sidebar">
        <div className="signal-sidebar__card">
          <p className="signal-sidebar__card-title">Combined Impact</p>
          <p className={`signal-sidebar__net-impact ${isNegative ? 'signal-sidebar__net-impact--negative' : 'signal-sidebar__net-impact--positive'}`}>
            {formatDollar(netOneMonth)}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            across {signals.length} active signals
          </p>
        </div>
      </aside>

      {selectedNode && (
        <NodeDetailSheet node={selectedNode} onClose={handleCloseSheet} />
      )}
    </>
  )
}
