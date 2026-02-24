import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CausalChainNode } from '@prism/shared'
import { Disclaimer } from '../components/shared/Disclaimer'
import { useSignals } from '../hooks/useSignals'
import { useCausalChain } from '../hooks/useCausalChain'
import type { GraphTimeHorizon } from '../types/graph'
import { CausalGraph } from '../components/graph/CausalGraph'
import { CounterfactualToggle } from '../components/graph/CounterfactualToggle'
import { GraphLegend } from '../components/graph/GraphLegend'
import { SignalSwitcher } from '../components/graph/SignalSwitcher'
import { TimeSlider } from '../components/graph/TimeSlider'
import { getHorizonAdjustedImpact } from '../components/graph/graph-utils'
import '../styles/graph.css'

const DEFAULT_USER_ID = 'sarah-01'

function formatCurrency(value: number): string {
  return `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString('en-CA', { maximumFractionDigits: 0 })}`
}

export function CausalGraphView() {
  const { signalId } = useParams<{ signalId: string }>()
  const navigate = useNavigate()

  const [horizon, setHorizon] = useState<GraphTimeHorizon>('oneMonth')
  const [counterfactualEnabled, setCounterfactualEnabled] = useState(false)
  const [expandedDepth, setExpandedDepth] = useState(false)
  const [selectedNode, setSelectedNode] = useState<CausalChainNode | null>(null)

  const {
    signals,
    loading: signalsLoading,
    error: signalsError,
  } = useSignals(DEFAULT_USER_ID)

  const effectiveSignalId = signalId ?? signals[0]?.id
  const { data, loading, error, refetch } = useCausalChain(DEFAULT_USER_ID, effectiveSignalId)

  useEffect(() => {
    if (!signalId && signals.length > 0) {
      navigate(`/graph/${encodeURIComponent(signals[0].id)}`, { replace: true })
    }
  }, [navigate, signalId, signals])

  useEffect(() => {
    setSelectedNode(null)
  }, [effectiveSignalId])

  useEffect(() => {
    if (!data?.temporalAnalysis.counterfactual && counterfactualEnabled) {
      setCounterfactualEnabled(false)
    }
  }, [counterfactualEnabled, data])

  const selectedNodeImpact = useMemo(() => {
    if (!selectedNode || !data) return 0
    return getHorizonAdjustedImpact(
      selectedNode,
      data.temporalAnalysis,
      horizon,
      counterfactualEnabled,
    )
  }, [counterfactualEnabled, data, horizon, selectedNode])

  function handleBack(): void {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/portfolio')
  }

  function handleSignalSelect(nextSignalId: string): void {
    if (!nextSignalId) return
    navigate(`/graph/${encodeURIComponent(nextSignalId)}`)
  }

  const signalErrorMessage = signalsError ? `Signals: ${signalsError}` : null
  const graphErrorMessage = error ? `Graph: ${error}` : null

  return (
    <div className="view graph-view">
      <header className="graph-header">
        <button type="button" className="graph-header__back" onClick={handleBack}>
          ← Back to Portfolio
        </button>
        <div className="graph-header__title">
          <h1>Causal Graph</h1>
          <p>Explore how this market signal propagates through your holdings.</p>
        </div>
      </header>

      <main>
        <section className="graph-controls">
          <SignalSwitcher
            signals={signals}
            activeSignalId={effectiveSignalId}
            onSelect={handleSignalSelect}
          />

          <TimeSlider value={horizon} onChange={setHorizon} />

          <CounterfactualToggle
            enabled={counterfactualEnabled}
            available={Boolean(data?.temporalAnalysis.counterfactual)}
            onToggle={setCounterfactualEnabled}
          />

          <button
            type="button"
            className="graph-control graph-control--button"
            onClick={() => setExpandedDepth((value) => !value)}
          >
            {expandedDepth ? 'Collapse 3rd-order effects' : 'Expand 3rd-order effects'}
          </button>
        </section>

        {(signalsLoading || loading) && (
          <div className="graph-status">Loading causal graph data...</div>
        )}

        {(signalErrorMessage || graphErrorMessage) && (
          <div className="graph-error-banner">
            {signalErrorMessage && <p>{signalErrorMessage}</p>}
            {graphErrorMessage && <p>{graphErrorMessage}</p>}
            <button type="button" onClick={() => void refetch()}>
              Retry
            </button>
            <p className="graph-error-banner__hint">
              Ensure backend server is running and Gemini API key/model access are valid.
            </p>
          </div>
        )}

        {data && !loading && !graphErrorMessage && (
          <>
            <section className="graph-layout">
              <article className="graph-layout__canvas">
                <h2>{data.signal.headline}</h2>
                <p>{data.chain.summary}</p>

                <CausalGraph
                  chain={data.chain}
                  temporalAnalysis={data.temporalAnalysis}
                  horizon={horizon}
                  counterfactualEnabled={counterfactualEnabled}
                  expandedDepth={expandedDepth}
                  selectedNodeId={selectedNode?.id ?? null}
                  onNodeSelect={setSelectedNode}
                />
              </article>

              <aside className={`graph-chat-drawer ${selectedNode ? 'is-open' : ''}`}>
                <div className="graph-chat-drawer__header">
                  <h3>Node Context</h3>
                  {selectedNode && (
                    <button type="button" onClick={() => setSelectedNode(null)}>
                      Close
                    </button>
                  )}
                </div>

                {!selectedNode && (
                  <p className="graph-chat-drawer__placeholder">
                    Click a node to open contextual analysis. Full chat interaction arrives in Feature 11.
                  </p>
                )}

                {selectedNode && (
                  <div className="graph-chat-drawer__content">
                    <h4>{selectedNode.label}</h4>
                    <p>{selectedNode.description}</p>
                    <dl>
                      <div>
                        <dt>Type</dt>
                        <dd>{selectedNode.type}</dd>
                      </div>
                      <div>
                        <dt>Confidence</dt>
                        <dd>{Math.round(selectedNode.confidence * 100)}%</dd>
                      </div>
                      <div>
                        <dt>Projected impact</dt>
                        <dd>{formatCurrency(selectedNodeImpact)}</dd>
                      </div>
                      {selectedNode.temporalClassification && (
                        <div>
                          <dt>Temporal class</dt>
                          <dd>{selectedNode.temporalClassification.replace('_', ' ')}</dd>
                        </div>
                      )}
                    </dl>
                    <p className="graph-chat-drawer__next-step">
                      Use this node as chat context once the drawer agent ships in Feature 11.
                    </p>
                  </div>
                )}
              </aside>
            </section>

            <GraphLegend />
          </>
        )}
      </main>

      <Disclaimer />
    </div>
  )
}
