import { useCallback, useMemo, useState } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import type { CausalChainNode } from '@prism/shared'
import { useCausalChain } from '../../hooks/useCausalChain'
import { CausalGraph } from '../../components/graph/CausalGraph'
import { SignalStory } from '../../components/signal/SignalStory'
import { AffectedHoldingsTable } from '../../components/signal/AffectedHoldingsTable'
import { SignalImpactSidebar } from '../../components/signal/SignalImpactSidebar'
import { EvidenceSection } from '../../components/signal/EvidenceSection'
import { NodeDetailSheet } from '../../components/signal/NodeDetailSheet'
import { DetailTabs } from '../../components/signal/DetailTabs'
import type { SignalsOutletContext } from './SignalsLayout'
import '../../styles/signal-detail.css'

export function SignalDetailPane() {
  const { signalId } = useParams<{ signalId: string }>()
  const { signals, userId } = useOutletContext<SignalsOutletContext>()

  const signal = signals.find((s) => s.id === signalId)
  const { data: graphData, loading: graphLoading, error: graphError } = useCausalChain(userId, signalId)

  const [selectedNode, setSelectedNode] = useState<CausalChainNode | null>(null)

  const handleNodeSelect = useCallback((node: CausalChainNode) => {
    setSelectedNode(node)
  }, [])

  const handleCloseSheet = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const tabs = useMemo(() => {
    if (!signal) return []
    return [
      {
        id: 'story',
        label: 'Story',
        content: <SignalStory signal={signal} portfolioSummary={signal.portfolioSummary} />,
      },
      {
        id: 'holdings',
        label: 'Holdings',
        content: graphData ? <AffectedHoldingsTable chain={graphData.chain} /> : <p>Loading holdings...</p>,
      },
      {
        id: 'evidence',
        label: 'Evidence',
        content: <EvidenceSection signal={signal} />,
      },
    ]
  }, [signal, graphData])

  if (!signal) {
    return <div className="signals-center__loading">Signal not found.</div>
  }

  return (
    <>
      {/* Center pane: graph + tabs */}
      <div className="signals-center">
        <div className="signals-center__graph">
          {graphData && (
            <CausalGraph
              chain={graphData.chain}
              temporalAnalysis={graphData.temporalAnalysis}
              horizon="oneMonth"
              counterfactualEnabled={false}
              expandedDepth={false}
              selectedNodeId={selectedNode?.id ?? null}
              onNodeSelect={handleNodeSelect}
              mode="canvas"
            />
          )}
          {graphLoading && (
            <div className="signals-center__loading">Generating causal analysis...</div>
          )}
          {graphError && (
            <div className="signals-center__loading" style={{ color: 'var(--color-negative)' }}>
              Failed to load causal analysis
            </div>
          )}
        </div>

        <div className="signals-center__below">
          <DetailTabs tabs={tabs} />
        </div>
      </div>

      {/* Right sidebar */}
      {graphData && signalId ? (
        <SignalImpactSidebar
          chain={graphData.chain}
          temporalAnalysis={graphData.temporalAnalysis}
          signalId={signalId}
        />
      ) : (
        <aside className="signal-sidebar" />
      )}

      {/* Node detail overlay */}
      {selectedNode && (
        <NodeDetailSheet node={selectedNode} onClose={handleCloseSheet} />
      )}
    </>
  )
}
