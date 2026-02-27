import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CausalChainNode } from '@prism/shared'
import type { GraphDataResponse, StrategyCandidate, StrategyDraft, StrategyEvaluation, StrategyScenarioItem } from '../types/graph'
import type { WorkspaceBranchCompare, WorkspaceCheckpoint, WorkspaceSnapshot } from '../types/workspace'
import { useAppContext } from '../contexts/AppContext'
import { useSignals } from '../hooks/useSignals'
import { useCausalChain } from '../hooks/useCausalChain'
import { usePortfolioNetImpact } from '../hooks/usePortfolioNetImpact'
import { useWorkspaceSessions } from '../hooks/useWorkspaceSessions'
import { useWorkspaceAutosave } from '../hooks/useWorkspaceAutosave'
import { useGraphExpansion } from '../hooks/useGraphExpansion'
import { useStrategyDraft } from '../hooks/useStrategyDraft'
import { useScenarioEvaluation } from '../hooks/useScenarioEvaluation'
import { parseStrategyCommand } from '../components/strategy/command-parser'
import { CandidateRail } from '../components/strategy/CandidateRail'
import { ScenarioCanvas } from '../components/strategy/ScenarioCanvas'
import { buildMitigationReasoningChain } from '../components/strategy/reasoning-graph'
import { StrategyCommandPanel, type StrategyCommandMessage } from '../components/strategy/StrategyCommandPanel'
import { StrategyEvaluationPanel } from '../components/strategy/StrategyEvaluationPanel'
import { CausalGraph } from '../components/graph/CausalGraph'
import { AskPrismDrawer } from '../components/portfolio/AskPrismDrawer'
import '../styles/strategy-studio.css'
import '../styles/workspace.css'
import '../styles/ask-prism-drawer.css'

function fallbackRiskCap(riskTolerance: string | undefined): number {
  if (riskTolerance === 'low') return 3
  if (riskTolerance === 'high') return 7
  return 5
}

function candidateToScenarioItem(candidate: StrategyCandidate): StrategyScenarioItem {
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
    allocationPct: candidate.proposedShiftPct,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function latestCheckpoint(
  checkpoints: ReadonlyArray<WorkspaceCheckpoint>,
  branchId: string | null,
): WorkspaceCheckpoint | null {
  if (!branchId) return null
  return checkpoints
    .filter((checkpoint) => checkpoint.branchId === branchId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
}

function buildSnapshot(
  baseGraphData: GraphDataResponse | null,
  scenarioItems: ReadonlyArray<StrategyScenarioItem>,
  evaluation: StrategyEvaluation | null,
  selectedSignalId: string | null,
  selectedNodeId: string | null,
): WorkspaceSnapshot {
  const mitigation = buildMitigationReasoningChain({
    signal: baseGraphData?.signal ?? null,
    sourceChain: baseGraphData?.chain ?? null,
    scenarioItems,
    temporalAnalysis: baseGraphData?.temporalAnalysis ?? null,
  })

  const graphLayers: Array<WorkspaceSnapshot['graphLayers'][number]> = []
  if (baseGraphData?.chain) {
    graphLayers.push({
      id: `impact-${baseGraphData.chain.id}`,
      kind: 'impact',
      chain: baseGraphData.chain,
      sourceSignalId: baseGraphData.signal.id,
    })
  }
  graphLayers.push({
    id: `mitigation-${mitigation.id}`,
    kind: 'mitigation',
    chain: mitigation,
    sourceSignalId: baseGraphData?.signal.id ?? null,
  })

  return {
    graphLayers,
    scenario: { items: scenarioItems },
    evaluation,
    selectedSignalId: baseGraphData?.signal.id ?? selectedSignalId,
    selectedNodeId,
  }
}

export function UnifiedWorkspaceView() {
  const { userId, profiles, askPrismOpen, setAskPrismOpen } = useAppContext()
  const [selectedSignalId, setSelectedSignalId] = useState<string | undefined>()
  const [activeGraphData, setActiveGraphData] = useState<GraphDataResponse | null>(null)
  const [scenarioItems, setScenarioItems] = useState<ReadonlyArray<StrategyScenarioItem>>([])
  const [draftReason, setDraftReason] = useState<string | null>(null)
  const [persistedEvaluation, setPersistedEvaluation] = useState<StrategyEvaluation | null>(null)
  const [selectedReasoningNode, setSelectedReasoningNode] = useState<CausalChainNode | null>(null)
  const [restoringCheckpointId, setRestoringCheckpointId] = useState<string | null>(null)
  const [compareBranchId, setCompareBranchId] = useState<string>('')
  const [compareResult, setCompareResult] = useState<WorkspaceBranchCompare | null>(null)
  const [commandRunning, setCommandRunning] = useState(false)
  const [commandMessages, setCommandMessages] = useState<ReadonlyArray<StrategyCommandMessage>>([
    {
      id: 'workspace-console-init',
      role: 'assistant',
      content:
        'Cursor workspace ready. Commands: Build mitigation plan, Add <ticker>, Remove <ticker>, Set <ticker> to <pct>%, Evaluate scenario.',
    },
  ])

  const { signals, loading: signalsLoading } = useSignals(userId)
  const { data: baseGraphData, loading: graphLoading } = useCausalChain(userId, selectedSignalId)
  const { data: netImpactData } = usePortfolioNetImpact(userId, true)

  const {
    sessions,
    activeBundle,
    loading: sessionsLoading,
    error: sessionsError,
    refreshSessions,
    loadSession,
    createSession,
    updateSession,
    createBranch,
    createCheckpoint,
    restoreCheckpoint,
    compareBranches,
    appendOperation,
  } = useWorkspaceSessions(userId)

  const {
    draft,
    loading: draftLoading,
    error: draftError,
    createDraft,
  } = useStrategyDraft(userId)

  const {
    evaluation,
    loading: evaluationLoading,
    error: evaluationError,
    evaluate,
    clear: clearEvaluation,
  } = useScenarioEvaluation(userId)

  const { loading: expandLoading, error: expandError, expandNode } = useGraphExpansion(userId)

  const profile = profiles.find((entry) => entry.id === userId)
  const riskCapPct = draft?.constraints.turnoverCapPct ?? fallbackRiskCap(profile?.riskTolerance)

  const activeBranchId = activeBundle?.session.activeBranchId ?? null
  const activeCheckpoint = useMemo(
    () => latestCheckpoint(activeBundle?.checkpoints ?? [], activeBranchId),
    [activeBundle?.checkpoints, activeBranchId],
  )
  const activeEvaluation = evaluation ?? persistedEvaluation

  const snapshot = useMemo(
    () =>
      buildSnapshot(
        activeGraphData,
        scenarioItems,
        activeEvaluation,
        selectedSignalId ?? null,
        selectedReasoningNode?.id ?? null,
      ),
    [activeEvaluation, activeGraphData, scenarioItems, selectedReasoningNode?.id, selectedSignalId],
  )

  const { queueAutosave, flushAutosave } = useWorkspaceAutosave({
    sessionId: activeBundle?.session.id ?? null,
    branchId: activeBranchId,
    snapshot,
    appendOperation,
  })

  const messageIdRef = useRef(0)
  const bootstrapSessionRef = useRef(false)

  const pushMessage = useCallback((role: StrategyCommandMessage['role'], content: string) => {
    messageIdRef.current += 1
    setCommandMessages((prev) => [...prev, { id: `workspace-msg-${messageIdRef.current}`, role, content }])
  }, [])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    if (selectedSignalId) return
    if (signals.length === 0) return
    setSelectedSignalId(signals[0].id)
  }, [selectedSignalId, signals])

  useEffect(() => {
    if (!baseGraphData) return
    setActiveGraphData(baseGraphData)
  }, [baseGraphData])

  useEffect(() => {
    if (sessions.length === 0 || activeBundle) return
    void loadSession(sessions[0].id)
  }, [activeBundle, loadSession, sessions])

  useEffect(() => {
    if (activeBundle || bootstrapSessionRef.current) return
    if (!selectedSignalId || !activeGraphData) return

    bootstrapSessionRef.current = true
    void createSession({
      scope: 'signal',
      signalId: selectedSignalId,
      title: `${activeGraphData.signal.headline} Workspace`,
      initialSnapshot: snapshot,
    })
  }, [activeBundle, activeGraphData, createSession, selectedSignalId, snapshot])

  useEffect(() => {
    if (!activeCheckpoint) return
    const checkpointSignalId = activeCheckpoint.snapshot.selectedSignalId ?? undefined
    if (checkpointSignalId && checkpointSignalId !== selectedSignalId) {
      setSelectedSignalId(checkpointSignalId)
    }
    setScenarioItems(activeCheckpoint.snapshot.scenario.items)
    setPersistedEvaluation(activeCheckpoint.snapshot.evaluation ?? null)
    setSelectedReasoningNode(null)
    clearEvaluation()
    setCompareResult(null)
  }, [activeCheckpoint, clearEvaluation, selectedSignalId])

  const loadDraft = useCallback(
    async (seedSummary?: string): Promise<StrategyDraft | null> => {
      const payload = await createDraft({
        signalId: selectedSignalId,
        seedSummary,
        maxCandidates: 6,
      })
      if (!payload) return null
      setScenarioItems(payload.scenario.items)
      setDraftReason(seedSummary ?? payload.seedSummary ?? payload.signalHeadline)
      setPersistedEvaluation(null)
      clearEvaluation()
      queueAutosave('chat_proposal', { seedSummary: seedSummary ?? null })
      return payload
    },
    [clearEvaluation, createDraft, queueAutosave, selectedSignalId],
  )

  const candidates = draft?.candidates ?? []

  const addCandidate = useCallback(
    (candidate: StrategyCandidate): void => {
      setScenarioItems((prev) => {
        if (prev.some((item) => item.candidateId === candidate.id)) return prev
        return [...prev, candidateToScenarioItem(candidate)]
      })
      setPersistedEvaluation(null)
      clearEvaluation()
      queueAutosave('add_candidate', { candidateId: candidate.id, ticker: candidate.ticker })
    },
    [clearEvaluation, queueAutosave],
  )

  const removeCandidate = useCallback(
    (candidateId: string): void => {
      setScenarioItems((prev) => prev.filter((item) => item.candidateId !== candidateId))
      setPersistedEvaluation(null)
      clearEvaluation()
      queueAutosave('remove_candidate', { candidateId })
    },
    [clearEvaluation, queueAutosave],
  )

  const setAllocation = useCallback(
    (candidateId: string, nextAllocation: number): void => {
      setScenarioItems((prev) =>
        prev.map((item) =>
          item.candidateId === candidateId
            ? { ...item, allocationPct: clamp(nextAllocation, 0.5, 10) }
            : item,
        ),
      )
      setPersistedEvaluation(null)
      clearEvaluation()
      queueAutosave('set_allocation', { candidateId, allocationPct: nextAllocation })
    },
    [clearEvaluation, queueAutosave],
  )

  const evaluateScenario = useCallback(async (): Promise<StrategyEvaluation | null> => {
    const result = await evaluate({
      signalId: selectedSignalId,
      scenario: { items: scenarioItems },
      explicitOverride: false,
    })
    if (result) {
      setPersistedEvaluation(result)
      queueAutosave('evaluate', {
        score: result.score,
        turnoverPct: result.turnoverPct,
        downsideReductionCad: result.downsideReductionCad,
      })
    }
    return result
  }, [evaluate, queueAutosave, scenarioItems, selectedSignalId])

  const submitCommand = useCallback(
    async (message: string): Promise<void> => {
      pushMessage('user', message)
      const command = parseStrategyCommand(message)
      setCommandRunning(true)

      try {
        if (command.type === 'help') {
          pushMessage('assistant', 'Commands: Build mitigation plan, Add <ticker>, Remove <ticker>, Set <ticker> to <pct>%, Evaluate scenario.')
          return
        }

        if (command.type === 'build_draft') {
          const payload = await loadDraft(command.seedSummary)
          if (!payload) {
            pushMessage('assistant', 'Could not build draft. Try narrowing the prompt.')
            return
          }
          pushMessage(
            'assistant',
            `Draft ready with ${payload.candidates.length} candidates and ${payload.scenario.items.length} scenario positions.`,
          )
          return
        }

        if (command.type === 'add_candidate') {
          const candidate = candidates.find((entry) => entry.ticker.toUpperCase() === command.ticker)
          if (!candidate) {
            pushMessage('assistant', `${command.ticker} is not in current proposals. Build a draft first.`)
            return
          }
          addCandidate(candidate)
          pushMessage('assistant', `${command.ticker} added to the canvas scenario.`)
          return
        }

        if (command.type === 'remove_candidate') {
          const existing = scenarioItems.find((item) => item.ticker.toUpperCase() === command.ticker)
          if (!existing) {
            pushMessage('assistant', `${command.ticker} is not in the current scenario.`)
            return
          }
          removeCandidate(existing.candidateId)
          pushMessage('assistant', `${command.ticker} removed from scenario.`)
          return
        }

        if (command.type === 'set_allocation') {
          const existing = scenarioItems.find((item) => item.ticker.toUpperCase() === command.ticker)
          if (!existing) {
            pushMessage('assistant', `${command.ticker} is not in scenario. Add it first.`)
            return
          }
          setAllocation(existing.candidateId, command.allocationPct)
          pushMessage('assistant', `${command.ticker} set to ${command.allocationPct.toFixed(1)}%.`)
          return
        }

        if (command.type === 'evaluate_scenario') {
          if (scenarioItems.length === 0) {
            pushMessage('assistant', 'Scenario is empty. Add candidates first.')
            return
          }
          const result = await evaluateScenario()
          if (!result) {
            pushMessage('assistant', 'Evaluation failed. Try again.')
            return
          }
          pushMessage(
            'assistant',
            `Score ${result.score.toFixed(1)}, downside reduction ${Math.round(result.downsideReductionCad)} CAD, turnover ${result.turnoverPct.toFixed(1)}%.`,
          )
          return
        }

        pushMessage('assistant', 'Command not recognized. Type help for valid commands.')
      } finally {
        setCommandRunning(false)
      }
    },
    [addCandidate, candidates, evaluateScenario, loadDraft, pushMessage, removeCandidate, scenarioItems, setAllocation],
  )

  const handleExpandNode = useCallback(async () => {
    if (!selectedReasoningNode || !activeGraphData || !selectedSignalId) return
    const expanded = await expandNode(activeGraphData, selectedSignalId, selectedReasoningNode.id, 2)
    if (!expanded) return
    setActiveGraphData(expanded)
    queueAutosave('expand_node', { nodeId: selectedReasoningNode.id, depth: 2 })
  }, [activeGraphData, expandNode, queueAutosave, selectedReasoningNode, selectedSignalId])

  const handleCreateBranch = useCallback(async () => {
    if (!activeBundle || !activeBranchId) return
    const nextName = `Branch ${activeBundle.branches.length}`
    const created = await createBranch(activeBundle.session.id, {
      name: nextName,
      parentCheckpointId: activeCheckpoint?.id ?? undefined,
    })
    if (!created) return

    await updateSession(activeBundle.session.id, { activeBranchId: created.id })
    await createCheckpoint(activeBundle.session.id, {
      branchId: created.id,
      label: 'Branch Start',
      snapshot,
    })
    await appendOperation(activeBundle.session.id, {
      branchId: created.id,
      type: 'create_branch',
      actor: 'human',
      payload: {
        branchId: created.id,
        branchName: created.name,
        fromCheckpointId: activeCheckpoint?.id ?? null,
      },
    })
    await loadSession(activeBundle.session.id)
  }, [activeBranchId, activeBundle, activeCheckpoint?.id, appendOperation, createBranch, createCheckpoint, loadSession, snapshot, updateSession])

  const handleSaveCheckpoint = useCallback(async () => {
    if (!activeBundle || !activeBranchId) return
    await createCheckpoint(activeBundle.session.id, {
      branchId: activeBranchId,
      label: `Checkpoint ${new Date().toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}`,
      snapshot,
    })
  }, [activeBranchId, activeBundle, createCheckpoint, snapshot])

  const handleSwitchBranch = useCallback(
    async (branchId: string) => {
      if (!activeBundle) return
      setCompareResult(null)
      await updateSession(activeBundle.session.id, { activeBranchId: branchId })
      await loadSession(activeBundle.session.id)
    },
    [activeBundle, loadSession, updateSession],
  )

  const handleCompare = useCallback(async () => {
    if (!activeBundle || !activeBranchId || !compareBranchId || compareBranchId === activeBranchId) return
    const result = await compareBranches(activeBundle.session.id, activeBranchId, compareBranchId)
    setCompareResult(result)
  }, [activeBranchId, activeBundle, compareBranchId, compareBranches])

  const handleRestoreCheckpoint = useCallback(
    async (checkpointId: string): Promise<void> => {
      if (!activeBundle) return
      setRestoringCheckpointId(checkpointId)
      try {
        const restored = await restoreCheckpoint(activeBundle.session.id, checkpointId)
        if (!restored) return
        await appendOperation(activeBundle.session.id, {
          branchId: restored.branchId,
          type: 'restore_checkpoint',
          actor: 'human',
          payload: { checkpointId: restored.id },
        })
        await loadSession(activeBundle.session.id)
      } finally {
        setRestoringCheckpointId(null)
      }
    },
    [activeBundle, appendOperation, loadSession, restoreCheckpoint],
  )

  const rightBranchCheckpoint = useMemo(
    () => latestCheckpoint(activeBundle?.checkpoints ?? [], compareBranchId || null),
    [activeBundle?.checkpoints, compareBranchId],
  )
  const activeBranchCheckpoints = useMemo(
    () =>
      (activeBundle?.checkpoints ?? [])
        .filter((checkpoint) => checkpoint.branchId === activeBranchId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [activeBranchId, activeBundle?.checkpoints],
  )

  const selectedSignal = useMemo(
    () => signals.find((signal) => signal.id === selectedSignalId) ?? activeGraphData?.signal ?? null,
    [activeGraphData?.signal, selectedSignalId, signals],
  )

  const compareChains = useMemo(() => {
    if (!activeGraphData || !activeCheckpoint || !rightBranchCheckpoint || !selectedSignal) return null

    return {
      left: buildMitigationReasoningChain({
        signal: selectedSignal,
        sourceChain: activeGraphData.chain,
        scenarioItems: activeCheckpoint.snapshot.scenario.items,
        temporalAnalysis: activeGraphData.temporalAnalysis,
      }),
      right: buildMitigationReasoningChain({
        signal: selectedSignal,
        sourceChain: activeGraphData.chain,
        scenarioItems: rightBranchCheckpoint.snapshot.scenario.items,
        temporalAnalysis: activeGraphData.temporalAnalysis,
      }),
    }
  }, [activeCheckpoint, activeGraphData, rightBranchCheckpoint, selectedSignal])

  const isBusy = signalsLoading || graphLoading || sessionsLoading

  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <div>
          <h1>Unified Workspace</h1>
          <p>Analyze impact, inspect causal logic, and design mitigation scenarios in one infinite-canvas workflow.</p>
        </div>
        <div className="workspace-header__stats">
          <span>Signals: {signals.length}</span>
          <span>Net 1M: {netImpactData ? `${netImpactData.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact >= 0 ? '+' : '-'}$${Math.abs(Math.round(netImpactData.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact)).toLocaleString('en-CA')}` : 'n/a'}</span>
          <span>Risk cap: {riskCapPct.toFixed(1)}%</span>
        </div>
      </header>

      {sessionsError && <p className="workspace-warning">{sessionsError}</p>}
      {draftError && <p className="workspace-warning">{draftError}</p>}
      {evaluationError && <p className="workspace-warning">{evaluationError}</p>}
      {expandError && <p className="workspace-warning">{expandError}</p>}

      <div className="workspace-grid">
        <aside className="workspace-left">
          <section className="workspace-panel">
            <div className="workspace-panel__head">
              <h3>Signals</h3>
            </div>
            <ul className="workspace-signal-list">
              {signals.map((signal) => (
                <li key={signal.id}>
                  <button
                    type="button"
                    className={`workspace-signal-btn ${selectedSignalId === signal.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setSelectedSignalId(signal.id)
                      setSelectedReasoningNode(null)
                      setCompareResult(null)
                      queueAutosave('select_signal', { signalId: signal.id })
                    }}
                  >
                    <span>{signal.headline}</span>
                    <small>{signal.urgency.toUpperCase()} · {Math.round(signal.relevanceScore * 100)}%</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="workspace-panel">
            <div className="workspace-panel__head workspace-panel__head--between">
              <h3>Sessions</h3>
              <button
                type="button"
                onClick={() => {
                  if (!selectedSignalId || !activeGraphData) return
                  void createSession({
                    scope: 'signal',
                    signalId: selectedSignalId,
                    title: `${activeGraphData.signal.headline} Workspace`,
                    initialSnapshot: snapshot,
                  })
                }}
              >
                New
              </button>
            </div>
            <ul className="workspace-session-list">
              {sessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    className={`workspace-session-btn ${activeBundle?.session.id === session.id ? 'is-active' : ''}`}
                    onClick={() => {
                      void loadSession(session.id)
                    }}
                  >
                    <span>{session.title}</span>
                    <small>{new Date(session.updatedAt).toLocaleString('en-CA')}</small>
                  </button>
                </li>
              ))}
            </ul>

            {activeBundle && (
              <div className="workspace-branch-tools">
                <label htmlFor="branch-select">Branch</label>
                <select
                  id="branch-select"
                  value={activeBranchId ?? ''}
                  onChange={(event) => {
                    void handleSwitchBranch(event.target.value)
                  }}
                >
                  {activeBundle.branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>

                <button type="button" onClick={() => void handleCreateBranch()}>
                  Create Branch
                </button>

                <label htmlFor="compare-select">Compare with</label>
                <select
                  id="compare-select"
                  value={compareBranchId}
                  onChange={(event) => setCompareBranchId(event.target.value)}
                >
                  <option value="">Select branch</option>
                  {activeBundle.branches
                    .filter((branch) => branch.id !== activeBranchId)
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                </select>

                <button type="button" onClick={() => void handleCompare()} disabled={!compareBranchId}>
                  Compare
                </button>
              </div>
            )}
          </section>

          <CandidateRail candidates={candidates} onAddCandidate={addCandidate} />
        </aside>

        <main className="workspace-center">
          {compareResult && compareChains && activeGraphData ? (
            <div className="workspace-compare">
              <div className="workspace-compare__metrics">
                <span>Score Δ {compareResult.metrics.scoreDelta.toFixed(2)}</span>
                <span>Turnover Δ {compareResult.metrics.turnoverDelta.toFixed(2)}%</span>
                <span>Downside Δ {Math.round(compareResult.metrics.downsideReductionDeltaCad)} CAD</span>
                <span>Nodes Δ {compareResult.metrics.nodeDelta}</span>
                <span>Edges Δ {compareResult.metrics.edgeDelta}</span>
              </div>

              <div className="workspace-compare__split">
                <div className="workspace-compare__panel">
                  <h4>Current Branch</h4>
                  <CausalGraph
                    chain={compareChains.left}
                    temporalAnalysis={activeGraphData.temporalAnalysis}
                    horizon="oneMonth"
                    counterfactualEnabled={false}
                    expandedDepth={true}
                    clusterAssets={false}
                    selectedNodeId={null}
                    onNodeSelect={() => {}}
                  />
                </div>
                <div className="workspace-compare__panel">
                  <h4>Compared Branch</h4>
                  <CausalGraph
                    chain={compareChains.right}
                    temporalAnalysis={activeGraphData.temporalAnalysis}
                    horizon="oneMonth"
                    counterfactualEnabled={false}
                    expandedDepth={true}
                    clusterAssets={false}
                    selectedNodeId={null}
                    onNodeSelect={() => {}}
                  />
                </div>
              </div>
            </div>
          ) : (
            <ScenarioCanvas
              signal={selectedSignal}
              sourceChain={activeGraphData?.chain ?? null}
              temporalAnalysis={activeGraphData?.temporalAnalysis ?? null}
              items={scenarioItems}
              onDropCandidateId={(candidateId) => {
                const candidate = candidates.find((item) => item.id === candidateId)
                if (candidate) addCandidate(candidate)
              }}
              onRemove={removeCandidate}
              onAllocationChange={setAllocation}
              onEvaluate={() => {
                void evaluateScenario()
              }}
              onReasoningNodeSelect={setSelectedReasoningNode}
            />
          )}

          {(isBusy || draftLoading || evaluationLoading) && (
            <p className="workspace-meta">Loading workspace context...</p>
          )}
        </main>

        <aside className="workspace-right">
          <div className="workspace-right__actions">
            <button
              type="button"
              onClick={() => {
                void evaluateScenario()
              }}
              disabled={evaluationLoading}
            >
              Evaluate
            </button>
            <button type="button" onClick={() => void handleSaveCheckpoint()} disabled={!activeBranchId}>
              Checkpoint
            </button>
            <button
              type="button"
              onClick={() => {
                void handleExpandNode()
              }}
              disabled={!selectedReasoningNode || expandLoading}
            >
              Expand Node
            </button>
          </div>

          <StrategyCommandPanel
            messages={commandMessages}
            disabled={commandRunning || draftLoading || evaluationLoading}
            onSubmit={(message) => {
              void submitCommand(message)
            }}
          />

          <StrategyEvaluationPanel
            evaluation={activeEvaluation}
            riskCapPct={riskCapPct}
            draftReason={draftReason}
          />

          <section className="workspace-panel workspace-checkpoints">
            <div className="workspace-panel__head workspace-panel__head--between">
              <h3>Checkpoints</h3>
              <span>{activeBranchCheckpoints.length}</span>
            </div>
            {activeBranchCheckpoints.length === 0 && (
              <p className="workspace-meta">No checkpoints for this branch yet.</p>
            )}
            {activeBranchCheckpoints.length > 0 && (
              <ul className="workspace-checkpoint-list">
                {activeBranchCheckpoints.slice(0, 8).map((checkpoint) => (
                  <li key={checkpoint.id}>
                    <button
                      type="button"
                      className={`workspace-checkpoint-btn ${activeCheckpoint?.id === checkpoint.id ? 'is-active' : ''}`}
                      onClick={() => {
                        void handleRestoreCheckpoint(checkpoint.id)
                      }}
                      disabled={restoringCheckpointId === checkpoint.id}
                    >
                      <span>{checkpoint.label ?? 'Autosave'}</span>
                      <small>{new Date(checkpoint.createdAt).toLocaleString('en-CA')}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="workspace-right__footer">
            {activeCheckpoint ? (
              <span>Last checkpoint: {new Date(activeCheckpoint.createdAt).toLocaleString('en-CA')}</span>
            ) : (
              <span>No checkpoint yet</span>
            )}
            <button
              type="button"
              onClick={() => {
                void flushAutosave()
              }}
            >
              Sync Now
            </button>
          </div>
        </aside>
      </div>

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
