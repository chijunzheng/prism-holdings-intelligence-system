import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import type { CausalChainNode } from '@prism/shared'
import { useAppContext } from '../contexts/AppContext'
import { useSignals } from '../hooks/useSignals'
import { useCausalChain } from '../hooks/useCausalChain'
import type { GraphTimeHorizon } from '../types/graph'
import { CausalGraph } from '../components/graph/CausalGraph'
import { CounterfactualToggle } from '../components/graph/CounterfactualToggle'
import { GraphLegend } from '../components/graph/GraphLegend'
import { SignalSwitcher } from '../components/graph/SignalSwitcher'
import { TimeSlider } from '../components/graph/TimeSlider'
import { ChatPanel } from '../components/chat/ChatPanel'
import '../styles/graph.css'
import '../styles/chat.css'

export function CausalGraphView() {
  const { userId } = useAppContext()
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
  } = useSignals(userId)

  const effectiveSignalId = signalId ?? signals[0]?.id
  const { data, loading, error, refetch } = useCausalChain(userId, effectiveSignalId)

  useEffect(() => {
    if (!signalId && signals.length > 0) {
      navigate(`/signals/${encodeURIComponent(signals[0].id)}`, { replace: true })
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

  function handleSignalSelect(nextSignalId: string): void {
    if (!nextSignalId) return
    navigate(`/signals/${encodeURIComponent(nextSignalId)}`)
  }

  const signalErrorMessage = signalsError ? `Signals: ${signalsError}` : null
  const graphErrorMessage = error ? `Graph: ${error}` : null

  return (
    <div className="view graph-view">
      <header className="graph-header">
        <Link to="/signals" className="graph-header__back">
          &larr; Back to Signals
        </Link>
        <div className="graph-header__title">
          <h1>Impact Analysis</h1>
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
                <ChatPanel
                  userId={userId}
                  node={selectedNode}
                  chain={data.chain}
                  signal={data.signal}
                  temporalAnalysis={data.temporalAnalysis}
                  onClose={() => setSelectedNode(null)}
                />
              </aside>
            </section>

            <GraphLegend />
          </>
        )}
      </main>
    </div>
  )
}
