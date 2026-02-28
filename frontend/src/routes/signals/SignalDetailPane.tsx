import { useCallback, useMemo, useState } from 'react'
import { useParams, useOutletContext } from 'react-router-dom'
import type { CausalChainNode } from '@prism/shared'
import { useCausalChain } from '../../hooks/useCausalChain'
import { useAppContext } from '../../contexts/AppContext'
import { CausalGraph } from '../../components/graph/CausalGraph'
import { AffectedHoldingsTable } from '../../components/signal/AffectedHoldingsTable'
import { SignalImpactSidebar } from '../../components/signal/SignalImpactSidebar'
import { EvidenceSection } from '../../components/signal/EvidenceSection'
import { SignalChipStrip } from '../../components/signal/SignalChipStrip'
import { DetailTabs } from '../../components/signal/DetailTabs'
import { getHorizonAdjustedImpact } from '../../components/graph/graph-utils'
import { LoadingDots } from '../../components/common/LoadingDots'
import type { SignalsOutletContext } from './SignalsLayout'
import '../../styles/signal-detail.css'

function formatTimeAgo(isoDate: string): string {
  const ms = Date.now() - Date.parse(isoDate)
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function temporalLabel(classification?: string): string {
  if (classification === 'transient') return 'Transient'
  if (classification === 'structural') return 'Structural'
  return 'Ambiguous'
}

function formatSignedCad(amount: number): string {
  const prefix = amount < 0 ? '-' : '+'
  const abs = Math.abs(amount)
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

function nodeTypeLabel(type: CausalChainNode['type']): string {
  if (type === 'event') return 'Event'
  if (type === 'mechanism') return 'Mechanism'
  if (type === 'sector') return 'Sector'
  return 'Holding'
}

function nodeRoleNarrative(type: CausalChainNode['type']): string {
  if (type === 'event') {
    return 'This node is a regime trigger. It introduces the upstream condition that starts the transmission path.'
  }
  if (type === 'mechanism') {
    return 'This node captures the causal transmission mechanism that links the signal narrative to sector-level effects.'
  }
  if (type === 'sector') {
    return 'This node represents the sector-level channel where pressure accumulates before impacts land on holdings.'
  }
  return 'This node is a portfolio holding endpoint where modeled transmission is converted into estimated portfolio impact.'
}

export function SignalDetailPane() {
  const { signalId } = useParams<{ signalId: string }>()
  const { signals, userId } = useOutletContext<SignalsOutletContext>()
  const { setAskPrismOpen, setActiveAskPrismEntryContext } = useAppContext()

  const signal = signals.find((s) => s.id === signalId)
  const { data: graphData, loading: graphLoading, error: graphError } = useCausalChain(userId, signalId)

  const [selectedNode, setSelectedNode] = useState<CausalChainNode | null>(null)

  const handleNodeSelect = useCallback((node: CausalChainNode) => {
    setSelectedNode(node)
  }, [])

  const handleDiscussNode = useCallback(() => {
    if (selectedNode && signalId) {
      setActiveAskPrismEntryContext({
        entryType: 'graph_node',
        signalId,
        nodeId: selectedNode.id,
        nodeLabel: selectedNode.label,
        autoPrompt: `Explain how ${selectedNode.label} transmits risk/opportunity into my holdings for this signal.`,
      })
    } else if (signalId) {
      setActiveAskPrismEntryContext({
        entryType: 'sidebar_cta',
        signalId,
      })
    }
    setAskPrismOpen(true)
  }, [selectedNode, setActiveAskPrismEntryContext, setAskPrismOpen, signalId])

  const tabs = useMemo(() => {
    if (!signal) return []
    return [
      {
        id: 'causal-map',
        label: 'Causal Map',
        content: (
          <div className="signals-main__graph">
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
              <LoadingDots className="loading-dots--inline" />
            )}
            {graphError && (
              <div className="signals-main__loading" style={{ color: 'var(--color-negative)' }}>
                Failed to load causal analysis
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'holdings',
        label: 'Holdings',
        content: graphData ? <AffectedHoldingsTable chain={graphData.chain} /> : <p>Loading holdings...</p>,
      },
      {
        id: 'sources',
        label: 'Sources',
        content: <EvidenceSection signal={signal} />,
      },
    ]
  }, [signal, graphData, graphLoading, graphError, selectedNode, handleNodeSelect])

  if (!signal) {
    return <div className="signals-main__loading">Signal not found.</div>
  }

  if (graphLoading && !graphData) {
    return (
      <div className="signals-main signals-main--detail">
        <LoadingDots className="loading-dots--full-page" />
      </div>
    )
  }

  const selectedNodeImpactOneMonth = selectedNode && graphData
    ? getHorizonAdjustedImpact(selectedNode, graphData.temporalAnalysis, 'oneMonth', false)
    : 0
  const selectedNodeRawImpact = selectedNode?.dollarImpact ?? null

  return (
    <>
      {/* Main column */}
      <div className="signals-main signals-main--detail">
        <SignalChipStrip signals={signals} />

        <div className="signals-main__content signal-detail__stack">
          <section className="signals-panel signal-detail__analysis-panel">
            {/* Signal hero */}
            <div className="signal-hero">
              <h1 className="signal-hero__headline">{signal.headline}</h1>
              <div className="signal-hero__meta">
                <span className={`signal-hero__urgency signal-hero__urgency--${signal.urgency}`}>
                  {signal.urgency}
                </span>
                <span>{temporalLabel(signal.temporalClassification)}</span>
                <span>{formatTimeAgo(signal.detectedAt)}</span>
              </div>
              {signal.portfolioSummary && (
                <p className="signal-hero__summary">{signal.portfolioSummary}</p>
              )}
            </div>

            {/* Tabs: Causal Map / Holdings / Sources */}
            <DetailTabs tabs={tabs} />
          </section>

          {/* Selected node detail card as separate panel */}
          {selectedNode && (
            <section className="signals-panel signal-detail__node-panel">
              <div className="signal-node-card__header">
                <div>
                  <h3 className="signal-node-card__title">{selectedNode.label}</h3>
                  <p className="signal-node-card__type">{nodeTypeLabel(selectedNode.type)}</p>
                </div>
                <span className="signal-node-card__confidence">
                  {(selectedNode.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>

              <div className="signal-node-card__metrics">
                <div className="signal-node-card__metric-row">
                  <span>Impact (1 month)</span>
                  <strong className={selectedNodeImpactOneMonth < 0 ? 'affected-holdings__impact--negative' : 'affected-holdings__impact--positive'}>
                    {formatSignedCad(selectedNodeImpactOneMonth)}
                  </strong>
                </div>
                <div className="signal-node-card__metric-row">
                  <span>Node-local</span>
                  <strong>
                    {selectedNodeRawImpact === null ? 'n/a' : formatSignedCad(selectedNodeRawImpact)}
                  </strong>
                </div>
              </div>

              <div className="signal-node-card__quick-read">
                <p className="signal-node-card__description">{selectedNode.description}</p>
                <p className="signal-node-card__role">{nodeRoleNarrative(selectedNode.type)}</p>
              </div>

              <button
                type="button"
                className="path-insight__discuss"
                onClick={handleDiscussNode}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Discuss with Prism &rarr;
              </button>
            </section>
          )}
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
    </>
  )
}
