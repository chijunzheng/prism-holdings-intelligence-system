import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  AskPrismPlanAction,
  CausalChainNode,
  StrategyCandidate,
  StrategyScenarioItem,
} from '@prism/shared'
import { useAppContext } from '../../contexts/AppContext'
import { usePlan } from '../../hooks/usePlan'
import { useCausalChain } from '../../hooks/useCausalChain'
import { useSignals } from '../../hooks/useSignals'
import { usePortfolio } from '../../hooks/usePortfolio'
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

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : '+'
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function extractCandidateIdFromNode(node: CausalChainNode): string | null {
  if (node.id.startsWith('candidate-')) return node.id.slice('candidate-'.length)
  if (node.id.startsWith('thesis-')) return node.id.slice('thesis-'.length)
  const metadataCandidateId = asString(node.metadata.candidateId)
  return metadataCandidateId
}

interface PathInsightDetails {
  readonly summary: string
  readonly why: ReadonlyArray<string>
  readonly evidence: ReadonlyArray<string>
  readonly tradeoffs: ReadonlyArray<string>
  readonly monitor: ReadonlyArray<string>
}

function buildPathInsightDetails(
  selectedNode: CausalChainNode,
  reasoningChain: Readonly<{ readonly nodes: ReadonlyArray<CausalChainNode>; readonly edges: ReadonlyArray<{ readonly source: string; readonly target: string; readonly mechanism: string; readonly confidence: number }> }>,
  scenarioItems: ReadonlyArray<StrategyScenarioItem>,
  candidates: ReadonlyArray<StrategyCandidate>,
  selectedCandidateIds: ReadonlySet<string>,
  signalHeadline: string | null,
  evaluation: Readonly<{ readonly turnoverPct: number; readonly turnoverCapPct: number; readonly sixMonthGuardrailDeltaCad: number } | null>,
): PathInsightDetails {
  const role = asString(selectedNode.metadata.role) ?? 'unknown'
  const nodeById = new Map(reasoningChain.nodes.map((node) => [node.id, node]))
  const incomingEdges = reasoningChain.edges
    .filter((edge) => edge.target === selectedNode.id)
    .sort((a, b) => b.confidence - a.confidence)
  const outgoingEdges = reasoningChain.edges
    .filter((edge) => edge.source === selectedNode.id)
    .sort((a, b) => b.confidence - a.confidence)

  const candidateId = extractCandidateIdFromNode(selectedNode)
  const scenarioItem = candidateId
    ? scenarioItems.find((item) => item.candidateId === candidateId)
    : undefined
  const candidate = candidateId
    ? candidates.find((entry) => entry.id === candidateId)
    : undefined
  const isInScenario = Boolean(candidateId && selectedCandidateIds.has(candidateId))
  const expectedOffset = scenarioItem
    ? scenarioItem.expectedMitigationCad * scenarioItem.allocationPct
    : selectedNode.dollarImpact

  let summary = selectedNode.description
  if (role === 'impact-channel') {
    summary = `${selectedNode.label} is a key transmission channel where this signal likely impacts your holdings.`
  } else if (role === 'mitigation-thesis') {
    summary = `${selectedNode.label} explains the hedge thesis linking risk channel pressure to your chosen mitigation names.`
  } else if (role === 'mitigation-candidate') {
    summary = `${selectedNode.label} is a direct mitigation candidate connected to the highest-confidence risk channel in this path.`
  }

  const why: string[] = []
  if (role === 'source-signal') {
    why.push('This is the root market driver that starts the mitigation path.')
  } else if (role === 'impact-channel') {
    why.push('This channel was prioritized because it aggregates the largest inferred portfolio pressure from the signal.')
  } else if (role === 'mitigation-thesis') {
    why.push('This thesis node translates signal pressure into a hedgeable allocation action.')
  } else if (role === 'mitigation-candidate') {
    why.push('This candidate is linked to the selected risk channels and provides direct offset potential.')
  } else {
    why.push('This node is structurally important in the current mitigation path.')
  }

  if (scenarioItem) {
    why.push(
      `${scenarioItem.ticker} is sized at ${scenarioItem.allocationPct.toFixed(1)}% with ${(scenarioItem.confidence * 100).toFixed(0)}% confidence.`,
    )
  }

  if (typeof expectedOffset === 'number') {
    why.push(`Estimated offset contribution from this node is about ${formatDollar(expectedOffset)} over 1 month.`)
  }

  const evidence = [
    ...incomingEdges.slice(0, 2).map((edge) => {
      const sourceLabel = nodeById.get(edge.source)?.label ?? edge.source
      return `${sourceLabel} → ${selectedNode.label}: ${edge.mechanism} (${(edge.confidence * 100).toFixed(0)}% confidence)`
    }),
    ...outgoingEdges.slice(0, 2).map((edge) => {
      const targetLabel = nodeById.get(edge.target)?.label ?? edge.target
      return `${selectedNode.label} → ${targetLabel}: ${edge.mechanism} (${(edge.confidence * 100).toFixed(0)}% confidence)`
    }),
  ]

  const tradeoffs: string[] = []
  if (candidate) {
    tradeoffs.push(
      `Estimated implementation costs: turnover ${formatDollar(candidate.estimatedTurnoverCostCad)} and tax ${formatDollar(candidate.estimatedTaxCostCad)}.`,
    )
    tradeoffs.push(`Diversification score is ${candidate.diversificationScore.toFixed(2)} for this candidate.`)
  }
  if (!isInScenario && candidateId) {
    tradeoffs.push('This candidate is not currently active in your scenario; add it to include its hedge effect.')
  }
  if (evaluation) {
    tradeoffs.push(`Plan turnover is ${evaluation.turnoverPct.toFixed(1)}% vs cap ${evaluation.turnoverCapPct.toFixed(1)}%.`)
    if (evaluation.sixMonthGuardrailDeltaCad < 0) {
      tradeoffs.push('Current configuration weakens the 6-month guardrail and should be reviewed before execution.')
    }
  }

  const monitor = [
    ...(outgoingEdges.length > 0
      ? [
          `Monitor downstream nodes: ${outgoingEdges
            .slice(0, 2)
            .map((edge) => nodeById.get(edge.target)?.label ?? edge.target)
            .join(', ')}.`,
        ]
      : []),
    ...(signalHeadline ? [`If "${signalHeadline}" fades, reassess this node’s priority.`] : []),
    ...(scenarioItem ? [`Re-evaluate if ${scenarioItem.ticker} allocation changes materially from ${scenarioItem.allocationPct.toFixed(1)}%.`] : []),
  ]

  return {
    summary,
    why: why.length > 0 ? why : ['This node is part of the highest-confidence route in the current reasoning graph.'],
    evidence: evidence.length > 0 ? evidence : ['No explicit edge evidence available yet for this node.'],
    tradeoffs: tradeoffs.length > 0 ? tradeoffs : ['No major implementation trade-offs detected for this node.'],
    monitor: monitor.length > 0 ? monitor : ['Monitor signal momentum and candidate confidence for updates.'],
  }
}

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

type PresetId = 'conservative' | 'balanced' | 'aggressive' | 'low_turnover'

interface PlanPreset {
  readonly id: PresetId
  readonly label: string
  readonly description: string
  readonly multiplier: number
  readonly maxCandidates: number
}

const PLAN_PRESETS: ReadonlyArray<PlanPreset> = [
  {
    id: 'conservative',
    label: 'Conservative',
    description: 'Lower sizing with tighter turnover.',
    multiplier: 0.75,
    maxCandidates: 2,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Base suggested allocations.',
    multiplier: 1,
    maxCandidates: 3,
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    description: 'Higher risk-reduction sizing.',
    multiplier: 1.3,
    maxCandidates: 3,
  },
  {
    id: 'low_turnover',
    label: 'Low-turnover',
    description: 'Fewest changes and smaller trades.',
    multiplier: 0.65,
    maxCandidates: 2,
  },
]

function buildPresetActions(
  preset: PlanPreset,
  candidates: ReadonlyArray<StrategyCandidate>,
  selections: ReadonlyArray<{ readonly candidateId: string; readonly ticker: string }>,
): ReadonlyArray<AskPrismPlanAction> {
  const targetCandidates = candidates.slice(0, preset.maxCandidates)
  const targetIds = new Set(targetCandidates.map((candidate) => candidate.id))
  const actions: AskPrismPlanAction[] = []

  for (const selection of selections) {
    if (!targetIds.has(selection.candidateId)) {
      actions.push({
        type: 'remove_candidate',
        candidateId: selection.candidateId,
        ticker: selection.ticker,
      })
    }
  }

  const selectedById = new Set(selections.map((selection) => selection.candidateId))
  for (const candidate of targetCandidates) {
    const allocationPct = clamp(candidate.proposedShiftPct * preset.multiplier, 0.5, 10)
    if (selectedById.has(candidate.id)) {
      actions.push({
        type: 'set_allocation',
        candidateId: candidate.id,
        ticker: candidate.ticker,
        allocationPct,
      })
      continue
    }
    actions.push({
      type: 'add_candidate',
      candidateId: candidate.id,
      ticker: candidate.ticker,
      allocationPct,
    })
  }

  return actions
}

export function PlanView() {
  const { signalId } = useParams<{ signalId: string }>()
  const [searchParams] = useSearchParams()
  const restoreSessionId = searchParams.get('sessionId')
  const navigate = useNavigate()
  const { userId, askPrismOpen, setAskPrismOpen, setActiveAskPrismEntryContext } = useAppContext()
  const { portfolio } = usePortfolio(userId)
  const { signals } = useSignals(userId)
  const { data: graphData, loading: graphLoading, error: graphError } = useCausalChain(userId, signalId)

  const signal = signals.find((s) => s.id === signalId)

  const {
    candidates,
    selections,
    evaluation,
    draft,
    loading,
    reassessing,
    evaluating,
    error,
    addCandidate,
    removeCandidate,
    updateAllocation,
    applyCopilotActions,
    reassessRecommendations,
    markReviewed,
  } = usePlan(userId, signalId, restoreSessionId)

  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [selectedReasonNode, setSelectedReasonNode] = useState<CausalChainNode | null>(null)
  const [activePresetId, setActivePresetId] = useState<PresetId | null>(null)

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

  const topCandidates = useMemo(
    () => candidates.slice(0, 3),
    [candidates],
  )

  const missingTopCandidates = useMemo(
    () =>
      topCandidates.filter(
        (candidate) => !selections.some((selection) => selection.candidateId === candidate.id),
      ),
    [selections, topCandidates],
  )

  const portfolioTotalCad = portfolio?.totalValueCad ?? 0

  const holdingPriceByTicker = useMemo(() => {
    const map = new Map<string, number>()
    if (!portfolio) return map
    for (const account of portfolio.accounts) {
      for (const holding of account.holdings) {
        const ticker = holding.ticker.trim().toUpperCase()
        if (!ticker || holding.units <= 0) continue
        const impliedPrice = holding.valueCad / holding.units
        if (Number.isFinite(impliedPrice) && impliedPrice > 0) {
          map.set(ticker, impliedPrice)
        }
      }
    }
    return map
  }, [portfolio])

  const handleReview = useCallback(() => {
    setShowConfirmation(true)
  }, [])

  const handleAutoBuildDraft = useCallback(() => {
    missingTopCandidates.forEach((candidate) => {
      addCandidate(candidate.id, candidate.proposedShiftPct)
    })
  }, [addCandidate, missingTopCandidates])

  const handleApplyPreset = useCallback(
    (preset: PlanPreset) => {
      const actions = buildPresetActions(preset, candidates, selections)
      if (actions.length === 0) return
      setActivePresetId(preset.id)
      applyCopilotActions(actions)
    },
    [applyCopilotActions, candidates, selections],
  )

  const handleConfirm = useCallback(() => {
    setShowConfirmation(false)
    setConfirmed(true)
    markReviewed()
  }, [markReviewed])

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmation(false)
  }, [])

  const handleDiscussReasoning = useCallback(() => {
    if (signalId) {
      if (selectedReasonNode) {
        setActiveAskPrismEntryContext({
          entryType: 'graph_node',
          signalId,
          nodeId: selectedReasonNode.id,
          nodeLabel: selectedReasonNode.label,
          autoPrompt: `Explain how ${selectedReasonNode.label} changes mitigation trade-offs in my current Playbook.`,
        })
      } else {
        setActiveAskPrismEntryContext({
          entryType: 'signals_canvas',
          signalId,
          autoPrompt:
            'Discuss the full Playbook reasoning canvas and highlight what should change first to reduce downside.',
        })
      }
    } else {
      setActiveAskPrismEntryContext({ entryType: 'signals_canvas' })
    }
    setAskPrismOpen(true)
  }, [selectedReasonNode, setActiveAskPrismEntryContext, setAskPrismOpen, signalId])

  const signalHeadline =
    graphData?.signal.headline ??
    signal?.headline ??
    draft?.signalHeadline ??
    null

  const signalImpact =
    graphData?.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact ??
    draft?.baselineOneMonthCad ??
    evaluation?.baselineOneMonthCad ??
    null

  const selectedCandidateIds = useMemo(
    () => new Set(selections.map((selection) => selection.candidateId)),
    [selections],
  )

  const pathInsight = useMemo(() => {
    if (!selectedReasonNode) return null
    return buildPathInsightDetails(
      selectedReasonNode,
      reasoningChain,
      scenarioItems,
      candidates,
      selectedCandidateIds,
      signalHeadline,
      evaluation,
    )
  }, [
    candidates,
    evaluation,
    reasoningChain,
    scenarioItems,
    selectedCandidateIds,
    selectedReasonNode,
    signalHeadline,
  ])

  const positionSuggestionByCandidateId = useMemo(() => {
    const map = new Map<
      string,
      {
        readonly targetCad: number
        readonly referencePriceCad: number | null
        readonly estimatedShares: number | null
        readonly estimatedTradeCad: number | null
        readonly residualCad: number | null
        readonly sourceLabel: string
      }
    >()

    for (const candidate of candidates) {
      const selection = selections.find((entry) => entry.candidateId === candidate.id)
      const allocationPct = selection?.allocationPct ?? candidate.proposedShiftPct
      const targetCad = Math.max(0, portfolioTotalCad * Math.max(allocationPct, 0) / 100)
      const resolvedPrice =
        candidate.referencePriceCad ??
        holdingPriceByTicker.get(candidate.ticker.trim().toUpperCase()) ??
        null

      if (candidate.type === 'cash') {
        map.set(candidate.id, {
          targetCad,
          referencePriceCad: null,
          estimatedShares: null,
          estimatedTradeCad: targetCad,
          residualCad: 0,
          sourceLabel: 'cash position',
        })
        continue
      }

      if (!resolvedPrice || resolvedPrice <= 0) {
        map.set(candidate.id, {
          targetCad,
          referencePriceCad: null,
          estimatedShares: null,
          estimatedTradeCad: null,
          residualCad: null,
          sourceLabel: 'price unavailable',
        })
        continue
      }

      const estimatedShares = Math.max(0, Math.floor(targetCad / resolvedPrice))
      const estimatedTradeCad = estimatedShares * resolvedPrice
      map.set(candidate.id, {
        targetCad,
        referencePriceCad: resolvedPrice,
        estimatedShares,
        estimatedTradeCad,
        residualCad: clamp(targetCad - estimatedTradeCad, 0, targetCad),
        sourceLabel: candidate.quoteSource === 'holding_implied' ? 'holding-implied price' : 'model price',
      })
    }

    return map
  }, [candidates, holdingPriceByTicker, portfolioTotalCad, selections])

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

      {/* Header with signal context */}
      <div className="plan-view__header">
        <div className="plan-view__header-row">
          <h1 className="plan-view__title">Build Your Plan</h1>
          <button
            type="button"
            className="plan-view__reassess"
            onClick={() => void reassessRecommendations()}
            disabled={reassessing || evaluating}
          >
            {reassessing ? 'Reassessing…' : 'Reassess with AI'}
          </button>
        </div>
        <p className="plan-view__intro">
          Prism found {candidates.length} option{candidates.length !== 1 ? 's' : ''} to help offset
          {signalImpact !== null ? ` the ${formatDollar(signalImpact)} impact from` : ' the impact from'}
          {signalHeadline ? ` "${signalHeadline}"` : ' this signal'}.
        </p>
        <div className="plan-view__presets">
          <span className="plan-view__presets-label">Allocation presets</span>
          <div className="plan-view__presets-chips">
            {PLAN_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`plan-view__preset-chip${activePresetId === preset.id ? ' plan-view__preset-chip--active' : ''}`}
                onClick={() => handleApplyPreset(preset)}
                disabled={evaluating || reassessing || candidates.length === 0}
                title={preset.description}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="plan-view__reasoning" aria-label="Mitigation reasoning">
        <header className="plan-view__reasoning-header">
          <div>
            <h2 className="plan-view__reasoning-title">Why these candidates</h2>
            <p className="plan-view__reasoning-subtitle">
              These positions offset your exposure through sector hedging and safe-haven allocation.
            </p>
          </div>
          <button
            type="button"
            className="plan-view__discuss-prism"
            onClick={handleDiscussReasoning}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Discuss with Prism &rarr;
          </button>
        </header>

        {graphLoading && <p className="plan-view__reasoning-status">Loading source causal chain...</p>}
        {graphError && (
          <p className="plan-view__reasoning-status plan-view__reasoning-status--warning">
            Graph source unavailable ({graphError}). Showing inferred mitigation logic.
          </p>
        )}

        <div className="plan-view__reasoning-body">
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

          <section className="plan-view__reasoning-insight">
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
                <p className="plan-view__insight-summary">{pathInsight?.summary ?? selectedReasonNode.description}</p>

                {pathInsight && (
                  <>
                    <div className="plan-view__insight-block">
                      <p className="plan-view__insight-heading">Why this choice</p>
                      <ul className="plan-view__insight-list">
                        {pathInsight.why.map((line) => (
                          <li key={`${selectedReasonNode.id}-why-${line}`}>{line}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="plan-view__insight-block">
                      <p className="plan-view__insight-heading">Evidence path</p>
                      <ul className="plan-view__insight-list">
                        {pathInsight.evidence.map((line) => (
                          <li key={`${selectedReasonNode.id}-evidence-${line}`}>{line}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="plan-view__insight-block">
                      <p className="plan-view__insight-heading">Trade-offs</p>
                      <ul className="plan-view__insight-list">
                        {pathInsight.tradeoffs.map((line) => (
                          <li key={`${selectedReasonNode.id}-trade-${line}`}>{line}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="plan-view__insight-block">
                      <p className="plan-view__insight-heading">What to monitor</p>
                      <ul className="plan-view__insight-list">
                        {pathInsight.monitor.map((line) => (
                          <li key={`${selectedReasonNode.id}-monitor-${line}`}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </section>

      {/* 2-col: candidates + evaluation sidebar */}
      <div className="plan-view__layout">
        <div className="plan-view__main">
          <div className="plan-view__candidate-grid">
            {candidates.map((candidate) => {
              const selection = selections.find((s) => s.candidateId === candidate.id)
              return (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  isAdded={!!selection}
                  allocationPct={selection?.allocationPct ?? candidate.proposedShiftPct}
                  positionSuggestion={positionSuggestionByCandidateId.get(candidate.id)}
                  onAdd={addCandidate}
                  onRemove={removeCandidate}
                  onAllocationChange={updateAllocation}
                />
              )
            })}
          </div>

          {/* "Add top 3" at bottom of candidates list */}
          {candidates.length > 0 && (
            <button
              type="button"
              className="plan-view__add-top-btn"
              onClick={handleAutoBuildDraft}
              disabled={missingTopCandidates.length === 0}
            >
              {missingTopCandidates.length > 0
                ? `+ Add top ${missingTopCandidates.length} to scenario`
                : 'Top 3 already in scenario'}
            </button>
          )}
        </div>

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
        <AskPrismDrawer
          onClose={() => setAskPrismOpen(false)}
          planSelections={selections}
          planCandidates={candidates}
          onApplyPlanActions={applyCopilotActions}
        />
      )}
    </div>
  )
}
