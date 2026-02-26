import type { CausalChainNode, Signal } from '@prism/shared'
import type { GraphTimeHorizon, GraphDataResponse, PortfolioNetImpactResponse } from '../../types/graph'
import type { AnalysisMode, ImpactMobilePanel, ImpactRightTab } from './types'
import { CausalGraph } from '../../components/graph/CausalGraph'
import { ChatPanel } from '../../components/chat/ChatPanel'
import { SignalList } from '../../components/impact/SignalList'
import { ControlsSidebar } from '../../components/impact/ControlsSidebar'
import { RightPanel } from '../../components/impact/RightPanel'
import { NodeDetails } from '../../components/impact/NodeDetails'
import { ActionsPanel } from '../../components/impact/ActionsPanel'
import { SummaryBlock } from '../../components/impact/SummaryBlock'

interface ImpactDrilldownViewProps {
  readonly userId: string
  readonly analysisMode: AnalysisMode
  readonly selectedSignalId: string | undefined
  readonly selectedNode: CausalChainNode | null
  readonly horizon: GraphTimeHorizon
  readonly activeRightTab: ImpactRightTab
  readonly rightPanelOpen: boolean
  readonly pendingChatMessage: string | null
  readonly mobilePanel: ImpactMobilePanel
  readonly signals: ReadonlyArray<Signal>
  readonly signalsLoading: boolean
  readonly signalsError: string | null
  readonly graphData: GraphDataResponse | null
  readonly graphLoading: boolean
  readonly graphError: string | null
  readonly netImpactData: PortfolioNetImpactResponse | null
  readonly netImpactLoading: boolean
  readonly netImpactError: string | null
  readonly onModeChange: (mode: AnalysisMode) => void
  readonly onSignalSelect: (signalId: string) => void
  readonly onNodeSelect: (node: CausalChainNode) => void
  readonly onHorizonChange: (value: GraphTimeHorizon) => void
  readonly onRightTabChange: (tab: ImpactRightTab) => void
  readonly onCloseRightPanel: () => void
  readonly onRetryGraph: () => void
  readonly onRetryNetImpact: () => void
  readonly onDiscussAction: (summary: string) => void
  readonly onOpenStrategyFromAction: (summary: string) => void
  readonly onMobilePanelChange: (panel: ImpactMobilePanel) => void
}

function readableSourceLabel(src: { title: string; url: string; publisher?: string }): string {
  const isVertexUrl = (s: string) => s.includes('vertexaisearch') || s.includes('googleapis')
  if (src.title && !isVertexUrl(src.title)) return src.title
  if (src.publisher && !isVertexUrl(src.publisher)) return src.publisher
  try {
    const hostname = new URL(src.url).hostname.replace(/^www\./, '')
    return isVertexUrl(hostname) ? 'Source' : hostname
  } catch {
    return 'Source'
  }
}

export function ImpactDrilldownView({
  userId,
  analysisMode,
  selectedSignalId,
  selectedNode,
  horizon,
  activeRightTab,
  rightPanelOpen,
  pendingChatMessage,
  mobilePanel,
  signals,
  signalsLoading,
  signalsError,
  graphData,
  graphLoading,
  graphError,
  netImpactData,
  netImpactLoading,
  netImpactError,
  onModeChange,
  onSignalSelect,
  onNodeSelect,
  onHorizonChange,
  onRightTabChange,
  onCloseRightPanel,
  onRetryGraph,
  onRetryNetImpact,
  onDiscussAction,
  onOpenStrategyFromAction,
  onMobilePanelChange,
}: ImpactDrilldownViewProps) {
  const activeChain = analysisMode === 'portfolio' ? netImpactData?.chain ?? null : graphData?.chain ?? null
  const activeTemporal = analysisMode === 'portfolio'
    ? netImpactData?.temporalAnalysis ?? null
    : graphData?.temporalAnalysis ?? null
  const activeSignal = analysisMode === 'portfolio' ? null : graphData?.signal ?? null
  const activeError = analysisMode === 'portfolio' ? netImpactError : graphError
  const isLoading = analysisMode === 'portfolio' ? netImpactLoading : signalsLoading || graphLoading
  const hasGraph = Boolean(activeChain) && !isLoading && !activeError

  return (
    <>
      <div className="impact-mobile-tabs">
        {(['signals', 'graph', 'panel'] as const).map((panel) => (
          <button
            key={panel}
            type="button"
            className={`impact-mobile-tabs__tab ${mobilePanel === panel ? 'is-active' : ''}`}
            onClick={() => onMobilePanelChange(panel)}
          >
            {panel === 'signals' ? 'Signals' : panel === 'graph' ? 'Graph' : 'Panel'}
          </button>
        ))}
      </div>

      <div className="impact-analysis">
        <div className={`impact-left ${mobilePanel === 'signals' ? 'is-active-mobile' : ''}`}>
          <div className="impact-left__header">
            <h1 className="impact-left__title">Signal Intelligence</h1>
            <p className="impact-left__subtitle">
              {analysisMode === 'portfolio'
                ? 'Aggregate impact across all active signals'
                : 'Select a signal to trace impact on your holdings'}
            </p>
            <div className="impact-left__mode-toggle" role="tablist" aria-label="Impact analysis mode">
              <button
                type="button"
                role="tab"
                aria-selected={analysisMode === 'portfolio'}
                className={`impact-left__mode-btn ${analysisMode === 'portfolio' ? 'is-active' : ''}`}
                onClick={() => onModeChange('portfolio')}
              >
                Total Impact
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={analysisMode === 'signal'}
                className={`impact-left__mode-btn ${analysisMode === 'signal' ? 'is-active' : ''}`}
                onClick={() => onModeChange('signal')}
              >
                Signal Drill-down
              </button>
            </div>
          </div>

          <SignalList
            signals={signals}
            selectedSignalId={analysisMode === 'signal' ? selectedSignalId : undefined}
            loading={signalsLoading}
            error={signalsError}
            onSelect={onSignalSelect}
          />
        </div>

        <div className={`impact-center ${mobilePanel === 'graph' ? 'is-active-mobile' : ''}`}>
          {analysisMode === 'signal' && graphData && !graphLoading && !graphError && (
            <div className="impact-center__header">
              <h2 className="impact-center__headline">{graphData.signal.headline}</h2>
              <SummaryBlock summary={graphData.chain.summary} />
              {graphData.signal.sources.filter((source) => !source.url.includes('vertexaisearch')).length > 0 && (
                <p className="impact-center__sources">
                  Sources:{' '}
                  {graphData.signal.sources
                    .filter((source) => !source.url.includes('vertexaisearch'))
                    .map((source, index) => (
                      <span key={`${source.url}-${index}`}>
                        {index > 0 && ' · '}
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="impact-center__source-link"
                        >
                          {readableSourceLabel(source)} {' '}↗
                        </a>
                      </span>
                    ))}
                </p>
              )}
            </div>
          )}

          {analysisMode === 'portfolio' && netImpactData && !netImpactLoading && !netImpactError && (
            <div className="impact-center__header">
              <h2 className="impact-center__headline">Total Impact</h2>
              <SummaryBlock summary={netImpactData.chain.summary} />
              <p className="impact-center__sources">
                {netImpactData.includedSignalCount} of {netImpactData.signalUniverseCount} active signals included
                {' '}above score threshold {netImpactData.thresholdScore.toFixed(2)} using {netImpactData.weightingModel} weighting.
              </p>
            </div>
          )}

          {hasGraph && (
            <div className="impact-center__toolbar">
              <ControlsSidebar horizon={horizon} onHorizonChange={onHorizonChange} />
            </div>
          )}

          {isLoading && <div className="impact-center__status">Loading causal graph...</div>}

          {activeError && (
            <div className="impact-center__error">
              <p>{activeError}</p>
              <button
                type="button"
                onClick={() => {
                  if (analysisMode === 'portfolio') {
                    onRetryNetImpact()
                    return
                  }
                  onRetryGraph()
                }}
              >
                Retry
              </button>
            </div>
          )}

          {hasGraph && activeChain && activeTemporal && (
            <div className="impact-center__graph">
              <CausalGraph
                chain={activeChain}
                temporalAnalysis={activeTemporal}
                horizon={horizon}
                counterfactualEnabled={false}
                expandedDepth={true}
                clusterAssets={analysisMode !== 'portfolio'}
                selectedNodeId={selectedNode?.id ?? null}
                onNodeSelect={onNodeSelect}
              />
            </div>
          )}

          {!isLoading && !activeError && !activeChain && !signalsError && (
            <div className="impact-center__status">
              {analysisMode === 'portfolio'
                ? 'Total impact view is unavailable right now.'
                : 'Select a signal to view its causal impact graph.'}
            </div>
          )}
        </div>

        <RightPanel
          activeTab={activeRightTab}
          onTabChange={onRightTabChange}
          className={rightPanelOpen ? 'is-open' : ''}
          detailsContent={
            <NodeDetails
              node={selectedNode}
              chain={activeChain}
              temporalAnalysis={activeTemporal}
              horizon={horizon}
            />
          }
          chatContent={
            <ChatPanel
              userId={userId}
              node={analysisMode === 'portfolio' ? null : selectedNode}
              chain={analysisMode === 'portfolio' ? null : activeChain}
              signal={analysisMode === 'portfolio' ? null : activeSignal}
              temporalAnalysis={analysisMode === 'portfolio' ? null : activeTemporal}
              onClose={onCloseRightPanel}
              initialMessage={pendingChatMessage}
            />
          }
          quickActionsContent={
            <ActionsPanel
              temporalAnalysis={activeTemporal}
              mode={analysisMode}
              signalContributions={analysisMode === 'portfolio' ? netImpactData?.signalContributions : undefined}
              onDiscussAction={analysisMode === 'signal' ? onDiscussAction : undefined}
              onOpenStrategyStudio={onOpenStrategyFromAction}
            />
          }
        />

        <div className={`impact-overlay ${rightPanelOpen ? 'is-visible' : ''}`} onClick={onCloseRightPanel} />
      </div>
    </>
  )
}
