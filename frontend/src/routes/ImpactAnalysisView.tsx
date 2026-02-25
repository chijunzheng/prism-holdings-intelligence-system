import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { CausalChainNode } from '@prism/shared'
import type { GraphTimeHorizon } from '../types/graph'
import { useAppContext } from '../contexts/AppContext'
import { useSignals } from '../hooks/useSignals'
import { useCausalChain } from '../hooks/useCausalChain'
import { getMateriality, sortSignalsForCards } from '../components/portfolio/signal-utils'
import { CausalGraph } from '../components/graph/CausalGraph'
import { ChatPanel } from '../components/chat/ChatPanel'
import { SignalList } from '../components/impact/SignalList'
import { ControlsSidebar } from '../components/impact/ControlsSidebar'
import { RightPanel } from '../components/impact/RightPanel'
import { NodeDetails } from '../components/impact/NodeDetails'
import { ActionsPanel } from '../components/impact/ActionsPanel'
import '../styles/impact-analysis.css'
import '../styles/graph.css'
import '../styles/chat.css'

type RightTab = 'details' | 'chat' | 'actions'
type MobilePanel = 'signals' | 'graph' | 'panel'

export function ImpactAnalysisView() {
  const { userId } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Core State ──────────────────────────────
  const [selectedNode, setSelectedNode] = useState<CausalChainNode | null>(null)
  const [horizon, setHorizon] = useState<GraphTimeHorizon>('oneMonth')
  const [counterfactualEnabled, setCounterfactualEnabled] = useState(false)
  const [expandedDepth, setExpandedDepth] = useState(false)
  const [activeRightTab, setActiveRightTab] = useState<RightTab>('details')
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('signals')

  // ── Data ────────────────────────────────────
  const { signals, loading: signalsLoading, error: signalsError } = useSignals(userId)

  const materialSignals = useMemo(() => {
    const material = signals.filter((s) => getMateriality(s) !== 'low')
    return sortSignalsForCards(material)
  }, [signals])

  // Selected signal from URL query param
  const selectedSignalId = searchParams.get('signal') ?? undefined

  // Auto-select first signal when signals load and none selected
  useEffect(() => {
    if (!selectedSignalId && materialSignals.length > 0) {
      setSearchParams({ signal: materialSignals[0].id }, { replace: true })
    }
  }, [materialSignals, selectedSignalId, setSearchParams])

  const { data, loading: graphLoading, error: graphError, refetch } = useCausalChain(
    userId,
    selectedSignalId,
  )

  // Reset counterfactual if not available
  useEffect(() => {
    if (!data?.temporalAnalysis.counterfactual && counterfactualEnabled) {
      setCounterfactualEnabled(false)
    }
  }, [counterfactualEnabled, data])

  // ── Handlers ────────────────────────────────
  const handleSignalSelect = useCallback(
    (signalId: string) => {
      setSearchParams({ signal: signalId }, { replace: true })
      setSelectedNode(null)
      setMobilePanel('graph')
    },
    [setSearchParams],
  )

  const handleNodeSelect = useCallback(
    (node: CausalChainNode) => {
      setSelectedNode(node)
      setActiveRightTab('details')
      setRightPanelOpen(true)
    },
    [],
  )

  const handleCloseRightPanel = useCallback(() => {
    setRightPanelOpen(false)
  }, [])

  // ── Derived State ──────────────────────────
  const isLoading = signalsLoading || graphLoading
  const hasGraph = Boolean(data) && !graphLoading && !graphError

  return (
    <>
      {/* Mobile tab switcher */}
      <div className="impact-mobile-tabs">
        {(['signals', 'graph', 'panel'] as const).map((panel) => (
          <button
            key={panel}
            type="button"
            className={`impact-mobile-tabs__tab ${mobilePanel === panel ? 'is-active' : ''}`}
            onClick={() => setMobilePanel(panel)}
          >
            {panel === 'signals' ? 'Signals' : panel === 'graph' ? 'Graph' : 'Panel'}
          </button>
        ))}
      </div>

      <div className="impact-analysis">
        {/* ── Left: Signal List + Controls ─────── */}
        <div className={`impact-left ${mobilePanel === 'signals' ? 'is-active-mobile' : ''}`}>
          <div className="impact-left__header">
            <h1 className="impact-left__title">Impact Analysis</h1>
            <p className="impact-left__subtitle">Select a signal to trace its impact</p>
          </div>

          <SignalList
            signals={signals}
            selectedSignalId={selectedSignalId}
            loading={signalsLoading}
            error={signalsError}
            onSelect={handleSignalSelect}
          />

          {hasGraph && (
            <div className="impact-left__controls">
              <ControlsSidebar
                horizon={horizon}
                onHorizonChange={setHorizon}
                counterfactualEnabled={counterfactualEnabled}
                counterfactualAvailable={Boolean(data?.temporalAnalysis.counterfactual)}
                onCounterfactualToggle={setCounterfactualEnabled}
                expandedDepth={expandedDepth}
                onExpandToggle={() => setExpandedDepth((v) => !v)}
              />
            </div>
          )}
        </div>

        {/* ── Center: Causal Graph ────────────── */}
        <div className={`impact-center ${mobilePanel === 'graph' ? 'is-active-mobile' : ''}`}>
          {data && !graphLoading && !graphError && (
            <div className="impact-center__header">
              <h2 className="impact-center__headline">{data.signal.headline}</h2>
              <p className="impact-center__summary">{data.chain.summary}</p>
            </div>
          )}

          {isLoading && (
            <div className="impact-center__status">Loading causal graph...</div>
          )}

          {graphError && (
            <div className="impact-center__error">
              <p>{graphError}</p>
              <button type="button" onClick={() => void refetch()}>Retry</button>
            </div>
          )}

          {hasGraph && data && (
            <div className="impact-center__graph">
              <CausalGraph
                chain={data.chain}
                temporalAnalysis={data.temporalAnalysis}
                horizon={horizon}
                counterfactualEnabled={counterfactualEnabled}
                expandedDepth={expandedDepth}
                selectedNodeId={selectedNode?.id ?? null}
                onNodeSelect={handleNodeSelect}
              />
            </div>
          )}

          {!isLoading && !graphError && !data && !signalsError && (
            <div className="impact-center__status">
              Select a signal to view its causal impact graph.
            </div>
          )}

        </div>

        {/* ── Right: Tabbed Panel ─────────────── */}
        <RightPanel
          activeTab={activeRightTab}
          onTabChange={setActiveRightTab}
          className={rightPanelOpen ? 'is-open' : ''}
          detailsContent={<NodeDetails node={selectedNode} />}
          chatContent={
            <ChatPanel
              userId={userId}
              node={selectedNode}
              chain={data?.chain ?? null}
              signal={data?.signal ?? null}
              temporalAnalysis={data?.temporalAnalysis ?? null}
              onClose={handleCloseRightPanel}
            />
          }
          actionsContent={
            <ActionsPanel temporalAnalysis={data?.temporalAnalysis ?? null} />
          }
        />

        {/* Tablet overlay backdrop */}
        <div
          className={`impact-overlay ${rightPanelOpen ? 'is-visible' : ''}`}
          onClick={handleCloseRightPanel}
        />
      </div>
    </>
  )
}
