import { useCallback, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CausalChainNode } from '@prism/shared'
import { useAppContext } from '../../contexts/AppContext'
import { useSignals } from '../../hooks/useSignals'
import { useCausalChain } from '../../hooks/useCausalChain'
import { CausalGraph } from '../../components/graph/CausalGraph'
import { AskPrismDrawer } from '../../components/portfolio/AskPrismDrawer'
import { SignalStory } from '../../components/signal/SignalStory'
import { AffectedHoldingsTable } from '../../components/signal/AffectedHoldingsTable'
import { SignalImpactSidebar } from '../../components/signal/SignalImpactSidebar'
import { EvidenceSection } from '../../components/signal/EvidenceSection'
import { NodeDetailSheet } from '../../components/signal/NodeDetailSheet'
import '../../styles/signal-detail.css'
import '../../styles/graph.css'
import '../../styles/ask-prism-drawer.css'
import '../../styles/chat.css'

export function SignalDetailView() {
  const { signalId } = useParams<{ signalId: string }>()
  const navigate = useNavigate()
  const { userId, askPrismOpen, setAskPrismOpen } = useAppContext()

  const { signals, loading: signalsLoading } = useSignals(userId)
  const { data: graphData, loading: graphLoading, error: graphError } = useCausalChain(userId, signalId)

  const [selectedNode, setSelectedNode] = useState<CausalChainNode | null>(null)

  const signal = signals.find((s) => s.id === signalId)
  const loading = signalsLoading || graphLoading

  const handleNodeSelect = useCallback((node: CausalChainNode) => {
    setSelectedNode(node)
  }, [])

  const handleCloseSheet = useCallback(() => {
    setSelectedNode(null)
  }, [])

  if (loading && !signal) {
    return <div className="signal-detail__loading">Loading signal analysis...</div>
  }

  if (!signal) {
    return (
      <div className="signal-detail__error">
        <p>Signal not found.</p>
        <button type="button" className="signal-detail__back" onClick={() => navigate('/portfolio')}>
          &larr; Back to Portfolio
        </button>
      </div>
    )
  }

  return (
    <div className="view signal-detail">
      <button type="button" className="signal-detail__back" onClick={() => navigate('/portfolio')}>
        &larr; Back to Portfolio
      </button>

      <div className="signal-detail__layout">
        {/* Main content */}
        <div className="signal-detail__main">
          <SignalStory signal={signal} portfolioSummary={signal.portfolioSummary} />

          {graphData && (
            <AffectedHoldingsTable chain={graphData.chain} />
          )}

          {/* Embedded Causal Graph */}
          {graphData && (
            <section className="signal-detail__graph-section">
              <h2 className="signal-detail__graph-title">Causal Analysis</h2>
              <div className="signal-detail__graph-container">
                <CausalGraph
                  chain={graphData.chain}
                  temporalAnalysis={graphData.temporalAnalysis}
                  horizon="oneMonth"
                  counterfactualEnabled={false}
                  expandedDepth={false}
                  selectedNodeId={selectedNode?.id ?? null}
                  onNodeSelect={handleNodeSelect}
                  mode="embedded"
                />
              </div>
            </section>
          )}

          {graphLoading && (
            <p className="signal-detail__loading">Generating causal analysis...</p>
          )}

          {graphError && (
            <p className="signal-detail__error">Failed to load causal analysis: {graphError}</p>
          )}

          <EvidenceSection signal={signal} />
        </div>

        {/* Sidebar */}
        {graphData && signalId && (
          <SignalImpactSidebar
            chain={graphData.chain}
            temporalAnalysis={graphData.temporalAnalysis}
            signalId={signalId}
          />
        )}
      </div>

      {/* Node Detail Bottom Sheet */}
      {selectedNode && (
        <NodeDetailSheet node={selectedNode} onClose={handleCloseSheet} />
      )}

      {/* Ask Prism FAB + Drawer */}
      {!askPrismOpen && (
        <button
          type="button"
          className="ask-prism-fab"
          onClick={() => setAskPrismOpen(true)}
        >
          Ask Prism
        </button>
      )}

      {askPrismOpen && (
        <AskPrismDrawer onClose={() => setAskPrismOpen(false)} />
      )}
    </div>
  )
}
