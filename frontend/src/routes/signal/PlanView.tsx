import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { CausalChainNode, StrategyScenarioItem } from '@prism/shared'
import { useAppContext } from '../../contexts/AppContext'
import { usePlan } from '../../hooks/usePlan'
import { useCausalChain } from '../../hooks/useCausalChain'
import { CausalGraph } from '../../components/graph/CausalGraph'
import { CandidateCard } from '../../components/plan/CandidateCard'
import { PlanEvaluationSidebar } from '../../components/plan/PlanEvaluationSidebar'
import { PlanConfirmation } from '../../components/plan/PlanConfirmation'
import { AskPrismDrawer } from '../../components/portfolio/AskPrismDrawer'
import { buildMitigationReasoningChain } from '../../components/strategy/reasoning-graph'
import '../../styles/plan.css'
import '../../styles/ask-prism-drawer.css'
import '../../styles/chat.css'
import '../../styles/graph.css'

function buildFallbackTemporal(scenarioItems: ReadonlyArray<StrategyScenarioItem>) {
  const mitigation = scenarioItems.reduce(
    (sum, item) => sum + item.expectedMitigationCad * item.allocationPct,
    0,
  )
  const oneWeek = -Math.max(40, Math.round(mitigation * 0.18))
  const oneMonth = -Math.max(100, Math.round(mitigation * 0.32))
  const sixMonth = -Math.max(60, Math.round(mitigation * 0.2))

  return {
    classification: 'ambiguous' as const,
    confidence: 0.55,
    timeBuckets: {
      oneWeek: {
        direction: 'negative' as const,
        expectedDollarImpact: oneWeek,
        lowDollarImpact: oneWeek * 1.4,
        highDollarImpact: oneWeek * 0.5,
        confidence: 0.48,
      },
      oneMonth: {
        direction: 'negative' as const,
        expectedDollarImpact: oneMonth,
        lowDollarImpact: oneMonth * 1.5,
        highDollarImpact: oneMonth * 0.55,
        confidence: 0.52,
      },
      sixMonth: {
        direction: 'ambiguous' as const,
        expectedDollarImpact: sixMonth,
        lowDollarImpact: sixMonth * 1.7,
        highDollarImpact: Math.abs(sixMonth) * 0.45,
        confidence: 0.46,
      },
    },
    recommendations: [],
  }
}

export function PlanView() {
  const { signalId } = useParams<{ signalId: string }>()
  const [searchParams] = useSearchParams()
  const restoreSessionId = searchParams.get('sessionId')
  const navigate = useNavigate()
  const { userId, askPrismOpen, setAskPrismOpen } = useAppContext()
  const { data: graphData, loading: graphLoading, error: graphError } = useCausalChain(userId, signalId)

  const {
    candidates,
    selections,
    evaluation,
    draft,
    loading,
    evaluating,
    error,
    addCandidate,
    removeCandidate,
    updateAllocation,
    markReviewed,
  } = usePlan(userId, signalId, restoreSessionId)

  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [selectedReasonNode, setSelectedReasonNode] = useState<CausalChainNode | null>(null)

  const scenarioItems = useMemo<ReadonlyArray<StrategyScenarioItem>>(() => {
    if (selections.length > 0) {
      return selections
        .map((selection) => {
          const candidate = candidates.find((item) => item.id === selection.candidateId)
          if (!candidate) return null
          return {
            candidateId: candidate.id,
            ticker: candidate.ticker,
            name: candidate.name,
            type: candidate.type,
            rationale: candidate.rationale,
            confidence: candidate.confidence,
            expectedMitigationCad: candidate.expectedMitigationCad,
            diversificationScore: candidate.diversificationScore,
            estimatedTurnoverCostCad: candidate.estimatedTurnoverCostCad,
            estimatedTaxCostCad: candidate.estimatedTaxCostCad,
            allocationPct: selection.allocationPct,
          }
        })
        .filter((item): item is StrategyScenarioItem => item !== null)
    }

    return candidates.slice(0, 3).map((candidate) => ({
      candidateId: candidate.id,
      ticker: candidate.ticker,
      name: candidate.name,
      type: candidate.type,
      rationale: candidate.rationale,
      confidence: candidate.confidence,
      expectedMitigationCad: candidate.expectedMitigationCad,
      diversificationScore: candidate.diversificationScore,
      estimatedTurnoverCostCad: candidate.estimatedTurnoverCostCad,
      estimatedTaxCostCad: candidate.estimatedTaxCostCad,
      allocationPct: candidate.proposedShiftPct,
    }))
  }, [candidates, selections])

  const reasoningTemporal = graphData?.temporalAnalysis ?? buildFallbackTemporal(scenarioItems)

  const reasoningChain = useMemo(
    () =>
      buildMitigationReasoningChain({
        signal: graphData?.signal ?? null,
        sourceChain: graphData?.chain ?? null,
        scenarioItems,
        temporalAnalysis: graphData?.temporalAnalysis ?? null,
      }),
    [graphData?.chain, graphData?.signal, graphData?.temporalAnalysis, scenarioItems],
  )

  const handleReview = useCallback(() => {
    setShowConfirmation(true)
  }, [])

  const handleAutoBuildDraft = useCallback(() => {
    candidates.slice(0, 3).forEach((candidate) => {
      addCandidate(candidate.id, candidate.proposedShiftPct)
    })
  }, [addCandidate, candidates])

  const handleConfirm = useCallback(() => {
    setShowConfirmation(false)
    setConfirmed(true)
    markReviewed()
  }, [markReviewed])

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmation(false)
  }, [])

  if (loading) {
    return <div className="plan-view__loading">Loading strategy candidates...</div>
  }

  if (error) {
    return (
      <div className="plan-view__error">
        <p>Failed to load candidates: {error}</p>
        <button type="button" className="plan-view__back" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
      </div>
    )
  }

  return (
    <div className="view plan-view">
      <button type="button" className="plan-view__back" onClick={() => navigate(`/signals/${signalId}`)}>
        &larr; Back to Signal Detail
      </button>

      <div className="plan-view__header">
        <h1 className="plan-view__title">Build Your Plan</h1>
        <p className="plan-view__intro">
          Prism found {candidates.length} option{candidates.length !== 1 ? 's' : ''}.
          Add candidates to your plan, then review the evaluation.
        </p>
      </div>

      <section className="plan-view__reasoning" aria-label="Mitigation reasoning">
        <header className="plan-view__reasoning-header">
          <div>
            <h2 className="plan-view__reasoning-title">Why these candidates</h2>
            <p className="plan-view__reasoning-subtitle">
              Causal chain from signal pressure to mitigation thesis and recommended positions.
            </p>
          </div>
          <div className="plan-view__reasoning-actions">
            {selections.length === 0 && candidates.length > 0 && (
              <button type="button" className="plan-view__chip plan-view__chip--solid" onClick={handleAutoBuildDraft}>
                Add top 3 to scenario
              </button>
            )}
          </div>
        </header>

        {graphLoading && <p className="plan-view__reasoning-status">Loading source causal chain...</p>}
        {graphError && (
          <p className="plan-view__reasoning-status plan-view__reasoning-status--warning">
            Graph source unavailable ({graphError}). Showing inferred mitigation logic.
          </p>
        )}

        <div className="plan-view__reasoning-grid">
          <div className="plan-view__reasoning-graph">
            <CausalGraph
              chain={reasoningChain}
              temporalAnalysis={reasoningTemporal}
              horizon="oneMonth"
              counterfactualEnabled={false}
              expandedDepth={true}
              clusterAssets={false}
              selectedNodeId={selectedReasonNode?.id ?? null}
              onNodeSelect={setSelectedReasonNode}
              mode="embedded"
            />
          </div>

          <aside className="plan-view__reasoning-insight">
            <h3>Path insight</h3>
            {!selectedReasonNode && (
              <p>Select a node in the graph to inspect the logic and confidence behind each recommendation.</p>
            )}
            {selectedReasonNode && (
              <>
                <p className="plan-view__reasoning-node">{selectedReasonNode.label}</p>
                <p className="plan-view__reasoning-node-meta">
                  {selectedReasonNode.type} · {(selectedReasonNode.confidence * 100).toFixed(0)}% confidence
                </p>
                <p>{selectedReasonNode.description}</p>
              </>
            )}
          </aside>
        </div>
      </section>

      <div className="plan-view__layout">
        {/* Main: candidate cards */}
        <div className="plan-view__main">
          {candidates.map((candidate) => {
            const selection = selections.find((s) => s.candidateId === candidate.id)
            return (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                isAdded={!!selection}
                allocationPct={selection?.allocationPct ?? candidate.proposedShiftPct}
                onAdd={addCandidate}
                onRemove={removeCandidate}
                onAllocationChange={updateAllocation}
              />
            )
          })}
        </div>

        {/* Sidebar: evaluation */}
        <PlanEvaluationSidebar
          evaluation={evaluation}
          draft={draft}
          evaluating={evaluating}
          selectionCount={selections.length}
          onReview={handleReview}
        />
      </div>

      {confirmed && (
        <div className="plan-view__confirmed">
          Plan reviewed. Share or export options coming soon.
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirmation && (
        <PlanConfirmation
          selections={selections}
          evaluation={evaluation}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}

      {/* Ask Prism FAB + Drawer */}
      {!askPrismOpen && (
        <button
          type="button"
          className="ask-prism-fab"
          onClick={() => setAskPrismOpen(true)}
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
