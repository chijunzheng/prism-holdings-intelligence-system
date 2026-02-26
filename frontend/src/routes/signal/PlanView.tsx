import { useCallback, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAppContext } from '../../contexts/AppContext'
import { usePlan } from '../../hooks/usePlan'
import { CandidateCard } from '../../components/plan/CandidateCard'
import { PlanEvaluationSidebar } from '../../components/plan/PlanEvaluationSidebar'
import { PlanConfirmation } from '../../components/plan/PlanConfirmation'
import { AskPrismDrawer } from '../../components/portfolio/AskPrismDrawer'
import '../../styles/plan.css'
import '../../styles/ask-prism-drawer.css'
import '../../styles/chat.css'

export function PlanView() {
  const { signalId } = useParams<{ signalId: string }>()
  const [searchParams] = useSearchParams()
  const restoreSessionId = searchParams.get('sessionId')
  const navigate = useNavigate()
  const { userId, askPrismOpen, setAskPrismOpen } = useAppContext()

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

  const handleReview = useCallback(() => {
    setShowConfirmation(true)
  }, [])

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

      <div className="plan-view__disclaimer">
        This analysis is for informational purposes only and does not constitute financial advice.
        Prism does not execute trades. Always consult a qualified financial advisor.
      </div>

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
          Ask Prism
        </button>
      )}

      {askPrismOpen && (
        <AskPrismDrawer onClose={() => setAskPrismOpen(false)} />
      )}
    </div>
  )
}
