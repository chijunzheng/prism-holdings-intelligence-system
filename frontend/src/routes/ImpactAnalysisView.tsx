import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { CausalChainNode, Signal } from '@prism/shared'
import type { GraphTimeHorizon } from '../types/graph'
import { useAppContext } from '../contexts/AppContext'
import { useSignals } from '../hooks/useSignals'
import { useCausalChain } from '../hooks/useCausalChain'
import { usePortfolioNetImpact } from '../hooks/usePortfolioNetImpact'
import { getMateriality, sortSignalsForCards } from '../components/portfolio/signal-utils'
import { AskPrismDrawer } from '../components/portfolio/AskPrismDrawer'
import { traceImpact } from '../utils/trace'
import { UNIFIED_WORKSPACE_ENABLED } from '../utils/feature-flags'
import { ImpactOverviewView } from './impact/ImpactOverviewView'
import { ImpactDrilldownView } from './impact/ImpactDrilldownView'
import { StrategyStudioView } from './impact/StrategyStudioView'
import type { AnalysisMode, ImpactMobilePanel, ImpactRightTab, ImpactSubview } from './impact/types'
import '../styles/impact-analysis.css'
import '../styles/graph.css'
import '../styles/chat.css'
import '../styles/strategy-studio.css'
import '../styles/ask-prism-drawer.css'

export function ImpactAnalysisView() {
  const { userId, askPrismOpen, setAskPrismOpen, setActiveAskPrismEntryContext } = useAppContext()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedSignalId, setSelectedSignalId] = useState<string | undefined>(
    () => searchParams.get('signal') ?? undefined,
  )

  const [activeSubview, setActiveSubview] = useState<ImpactSubview>('overview')
  const [selectedNode, setSelectedNode] = useState<CausalChainNode | null>(null)
  const [horizon, setHorizon] = useState<GraphTimeHorizon>('oneMonth')
  const [activeRightTab, setActiveRightTab] = useState<ImpactRightTab>('quickActions')
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  const [pendingChatMessage, setPendingChatMessage] = useState<string | null>(null)
  const [mobilePanel, setMobilePanel] = useState<ImpactMobilePanel>('signals')
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('portfolio')
  const [strategyIntent, setStrategyIntent] = useState<string | null>(null)
  const graphSignalId =
    analysisMode === 'signal' || activeSubview === 'strategy' ? selectedSignalId : undefined

  const { data, loading: graphLoading, error: graphError, refetch } = useCausalChain(userId, graphSignalId)

  const {
    data: netImpactData,
    loading: netImpactLoading,
    error: netImpactError,
    refetch: refetchNetImpact,
  } = usePortfolioNetImpact(userId, analysisMode === 'portfolio')

  const {
    signals,
    loading: signalsLoading,
    error: signalsError,
  } = useSignals(userId)

  const orderedSignals = useMemo(() => sortSignalsForCards(signals), [signals])

  const materialSignals = useMemo(
    () => orderedSignals.filter((signal) => getMateriality(signal) !== 'low'),
    [orderedSignals],
  )

  useEffect(() => {
    if (selectedSignalId) return
    if (orderedSignals.length === 0) return
    setSelectedSignalId(orderedSignals[0].id)
  }, [orderedSignals, selectedSignalId])

  useEffect(() => {
    const signalFromQuery = searchParams.get('signal') ?? undefined
    if (!signalFromQuery || selectedSignalId === signalFromQuery) return
    setSelectedSignalId(signalFromQuery)
  }, [searchParams, selectedSignalId])

  useEffect(() => {
    const signalFromQuery = searchParams.get('signal') ?? undefined
    if (selectedSignalId === signalFromQuery) return

    const next = new URLSearchParams(searchParams)
    if (selectedSignalId) next.set('signal', selectedSignalId)
    else next.delete('signal')
    setSearchParams(next, { replace: true })
  }, [searchParams, selectedSignalId, setSearchParams])

  useEffect(() => {
    traceImpact('impact:view:state', {
      userId,
      activeSubview,
      analysisMode,
      selectedSignalId: selectedSignalId ?? null,
      signalsLoading,
      graphLoading,
      netImpactLoading,
      signalsTotal: signals.length,
      materialSignals: materialSignals.length,
      graphReady: Boolean(data),
      netReady: Boolean(netImpactData),
      graphError,
      netImpactError,
      signalsError,
    })
  }, [
    userId,
    activeSubview,
    analysisMode,
    selectedSignalId,
    signalsLoading,
    graphLoading,
    netImpactLoading,
    signals.length,
    materialSignals.length,
    data,
    netImpactData,
    graphError,
    netImpactError,
    signalsError,
  ])

  const selectedSignal = useMemo<Signal | null>(() => {
    if (analysisMode === 'signal' && data?.signal) return data.signal
    if (!selectedSignalId) return null
    return orderedSignals.find((signal) => signal.id === selectedSignalId) ?? null
  }, [analysisMode, data?.signal, orderedSignals, selectedSignalId])

  const focusTemporal = analysisMode === 'signal'
    ? data?.temporalAnalysis ?? null
    : netImpactData?.temporalAnalysis ?? null

  const openDrilldownSubview = useCallback(() => {
    setActiveSubview('drilldown')
  }, [])

  const openStrategyStudio = useCallback((seedSummary?: string) => {
    if (seedSummary) setStrategyIntent(seedSummary)
    setActiveSubview('strategy')
    setRightPanelOpen(false)
  }, [])

  const handleSignalSelect = useCallback((signalId: string) => {
    setSelectedSignalId(signalId)
    setAnalysisMode('signal')
    setSelectedNode(null)
    setMobilePanel('graph')
    setActiveSubview('drilldown')
    setActiveRightTab('details')
  }, [])

  const handleNodeSelect = useCallback((node: CausalChainNode) => {
    setSelectedNode(node)
    setActiveRightTab('details')
    setRightPanelOpen(true)
  }, [])

  const handleCloseRightPanel = useCallback(() => {
    setRightPanelOpen(false)
  }, [])

  const handleDiscussAction = useCallback((summary: string) => {
    setPendingChatMessage(`Tell me more about this recommendation: ${summary}`)
    setActiveRightTab('chat')
    setRightPanelOpen(true)
    setActiveSubview('drilldown')
    setMobilePanel('panel')
  }, [])

  const handleModeChange = useCallback((mode: AnalysisMode) => {
    setAnalysisMode(mode)
    setSelectedNode(null)
    setPendingChatMessage(null)
    setActiveRightTab(mode === 'portfolio' ? 'quickActions' : 'details')
  }, [])

  return (
    <div className="impact-workspace">
      <div className="impact-subview-tabs" role="tablist" aria-label="Impact analysis sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeSubview === 'overview'}
          className={`impact-subview-tabs__tab ${activeSubview === 'overview' ? 'is-active' : ''}`}
          onClick={() => setActiveSubview('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubview === 'drilldown'}
          className={`impact-subview-tabs__tab ${activeSubview === 'drilldown' ? 'is-active' : ''}`}
          onClick={() => setActiveSubview('drilldown')}
        >
          Drill-down
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeSubview === 'strategy'}
          className={`impact-subview-tabs__tab ${activeSubview === 'strategy' ? 'is-active' : ''}`}
          onClick={() => setActiveSubview('strategy')}
        >
          Strategy Studio
        </button>
        {UNIFIED_WORKSPACE_ENABLED && (
          <button
            type="button"
            className="impact-subview-tabs__cta"
            onClick={() => navigate('/signals')}
          >
            Open Unified Workspace
          </button>
        )}
      </div>

      <div className="impact-subview-content">
        {activeSubview === 'overview' && (
          <ImpactOverviewView
            signals={orderedSignals}
            materialSignalCount={materialSignals.length}
            selectedSignal={selectedSignal}
            netImpactData={netImpactData}
            temporalAnalysis={focusTemporal}
            onOpenDrilldown={openDrilldownSubview}
            onOpenStrategyStudio={openStrategyStudio}
          />
        )}

        {activeSubview === 'drilldown' && (
          <ImpactDrilldownView
            userId={userId}
            analysisMode={analysisMode}
            selectedSignalId={selectedSignalId}
            selectedNode={selectedNode}
            horizon={horizon}
            activeRightTab={activeRightTab}
            rightPanelOpen={rightPanelOpen}
            pendingChatMessage={pendingChatMessage}
            mobilePanel={mobilePanel}
            signals={orderedSignals}
            signalsLoading={signalsLoading}
            signalsError={signalsError}
            graphData={data}
            graphLoading={graphLoading}
            graphError={graphError}
            netImpactData={netImpactData}
            netImpactLoading={netImpactLoading}
            netImpactError={netImpactError}
            onModeChange={handleModeChange}
            onSignalSelect={handleSignalSelect}
            onNodeSelect={handleNodeSelect}
            onHorizonChange={setHorizon}
            onRightTabChange={setActiveRightTab}
            onCloseRightPanel={handleCloseRightPanel}
            onRetryGraph={() => {
              void refetch()
            }}
            onRetryNetImpact={() => {
              void refetchNetImpact()
            }}
            onDiscussAction={handleDiscussAction}
            onOpenStrategyFromAction={openStrategyStudio}
            onMobilePanelChange={setMobilePanel}
          />
        )}

        {activeSubview === 'strategy' && (
          <StrategyStudioView
            signal={selectedSignal}
            chain={data?.chain ?? null}
            temporalAnalysis={focusTemporal}
            draftSeed={strategyIntent}
            onDraftSeedConsumed={() => setStrategyIntent(null)}
            onOpenDrilldown={openDrilldownSubview}
          />
        )}
      </div>

      {!askPrismOpen && (
        <button
          type="button"
          className="ask-prism-fab"
          onClick={() => {
            setActiveAskPrismEntryContext(null)
            setAskPrismOpen(true)
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          Ask Prism
        </button>
      )}

      {askPrismOpen && (
        <AskPrismDrawer onClose={() => setAskPrismOpen(false)} />
      )}
    </div>
  )
}
