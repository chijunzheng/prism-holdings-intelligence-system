import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CausalChain, Signal } from '@prism/shared'
import type {
  StrategyCandidate,
  StrategyDraft,
  StrategyEvaluation,
  StrategyScenarioItem,
  TemporalAnalysis,
} from '../../types/graph'
import { useAppContext } from '../../contexts/AppContext'
import { useStrategyDraft } from '../../hooks/useStrategyDraft'
import { useScenarioEvaluation } from '../../hooks/useScenarioEvaluation'
import { parseStrategyCommand } from '../../components/strategy/command-parser'
import { CandidateRail } from '../../components/strategy/CandidateRail'
import { ScenarioCanvas } from '../../components/strategy/ScenarioCanvas'
import {
  StrategyCommandPanel,
  type StrategyCommandMessage,
} from '../../components/strategy/StrategyCommandPanel'
import { StrategyEvaluationPanel } from '../../components/strategy/StrategyEvaluationPanel'
import { StrategyStudioLayout } from '../../components/strategy/StrategyStudioLayout'

interface StrategyStudioViewProps {
  readonly signal: Signal | null
  readonly chain: CausalChain | null
  readonly temporalAnalysis: TemporalAnalysis | null
  readonly draftSeed: string | null
  readonly onDraftSeedConsumed: () => void
  readonly onOpenDrilldown: () => void
}

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

export function StrategyStudioView({
  signal,
  chain,
  temporalAnalysis,
  draftSeed,
  onDraftSeedConsumed,
  onOpenDrilldown,
}: StrategyStudioViewProps) {
  const { userId, profiles } = useAppContext()
  const {
    draft,
    loading: draftLoading,
    error: draftError,
    createDraft,
    clear: clearDraft,
  } = useStrategyDraft(userId)
  const {
    evaluation,
    loading: evaluationLoading,
    error: evaluationError,
    evaluate,
    clear: clearEvaluation,
  } = useScenarioEvaluation(userId)

  const [scenarioItems, setScenarioItems] = useState<ReadonlyArray<StrategyScenarioItem>>([])
  const [draftReason, setDraftReason] = useState<string | null>(null)
  const [commandRunning, setCommandRunning] = useState(false)
  const [commandMessages, setCommandMessages] = useState<ReadonlyArray<StrategyCommandMessage>>([
    {
      id: 'strategy-console-init',
      role: 'assistant',
      content:
        'I can run scenario commands here. Try: Build mitigation plan, Add ZAG, Set ZAG to 2%, Evaluate scenario.',
    },
  ])
  const appliedSeedRef = useRef<string | null>(null)
  const messageIdRef = useRef(0)

  const profile = profiles.find((entry) => entry.id === userId)
  const defaultRiskCapPct = fallbackRiskCap(profile?.riskTolerance)

  const riskCapPct = draft?.constraints.turnoverCapPct ?? defaultRiskCapPct
  const activeEvaluation: StrategyEvaluation | null = evaluation
  const hasDraftForCurrentContext = Boolean(
    draft &&
      (signal?.id ? draft.signalId === signal.id : true),
  )

  const pushMessage = useCallback((role: StrategyCommandMessage['role'], content: string) => {
    messageIdRef.current += 1
    setCommandMessages((prev) => [
      ...prev,
      { id: `strategy-console-${messageIdRef.current}`, role, content },
    ])
  }, [])

  const loadDraft = useCallback(
    async (seedSummary?: string): Promise<StrategyDraft | null> => {
      const payload = await createDraft({
        signalId: signal?.id,
        seedSummary,
        maxCandidates: 5,
      })
      if (!payload) return null
      setScenarioItems(payload.scenario.items)
      setDraftReason(seedSummary ?? payload.seedSummary ?? payload.signalHeadline)
      clearEvaluation()
      return payload
    },
    [clearEvaluation, createDraft, signal?.id],
  )

  useEffect(() => {
    if (draftSeed) {
      if (appliedSeedRef.current !== draftSeed) {
        appliedSeedRef.current = draftSeed
        void loadDraft(draftSeed)
        onDraftSeedConsumed()
      }
    }
  }, [draftSeed, loadDraft, onDraftSeedConsumed])

  useEffect(() => {
    if (!draft) return
    if (!signal?.id) return
    if (draft.signalId === signal.id) return

    clearDraft()
    clearEvaluation()
    setScenarioItems([])
    setDraftReason(null)
    pushMessage('assistant', 'Signal context changed. Run "Build mitigation plan" to generate a new draft.')
  }, [clearDraft, clearEvaluation, draft, pushMessage, signal?.id])

  const candidates = useMemo(
    () => (hasDraftForCurrentContext ? draft?.candidates ?? [] : []),
    [draft?.candidates, hasDraftForCurrentContext],
  )

  const addCandidate = (candidate: StrategyCandidate): void => {
    setScenarioItems((prev) => {
      if (prev.some((item) => item.candidateId === candidate.id)) return prev
      return [...prev, candidateToScenarioItem(candidate)]
    })
    clearEvaluation()
  }

  const removeCandidate = (candidateId: string): void => {
    setScenarioItems((prev) => prev.filter((item) => item.candidateId !== candidateId))
    clearEvaluation()
  }

  const setAllocation = (candidateId: string, nextAllocation: number): void => {
    setScenarioItems((prev) =>
      prev.map((item) =>
        item.candidateId === candidateId
          ? { ...item, allocationPct: clamp(nextAllocation, 0.5, 10) }
          : item,
      ),
    )
    clearEvaluation()
  }

  const evaluateScenario = async (): Promise<StrategyEvaluation | null> => {
    return evaluate({
      signalId: draft?.signalId ?? signal?.id,
      scenario: { items: scenarioItems },
      explicitOverride: false,
    })
  }

  const buildDraftFromSignal = (): void => {
    const summary = signal?.headline
      ? `Build mitigation plan for: ${signal.headline}`
      : 'Build mitigation plan from current portfolio context.'
    void loadDraft(summary)
  }

  const submitCommand = async (message: string): Promise<void> => {
    pushMessage('user', message)

    const command = parseStrategyCommand(message)
    setCommandRunning(true)
    try {
      if (command.type === 'help') {
        pushMessage(
          'assistant',
          'Commands: Build mitigation plan, Add <ticker>, Remove <ticker>, Set <ticker> to <pct>%, Evaluate scenario.',
        )
        return
      }

      if (command.type === 'build_draft') {
        const payload = await loadDraft(command.seedSummary)
        if (!payload) {
          pushMessage('assistant', 'Draft generation failed. Try again with a narrower prompt.')
          return
        }
        const topCandidates = payload.candidates
          .slice(0, 3)
          .map(
            (candidate) =>
              `${candidate.ticker} (${Math.round(candidate.confidence * 100)}%): ${candidate.rationale}`,
          )
          .join(' | ')
        pushMessage(
          'assistant',
          `Draft updated with ${payload.candidates.length} candidates and ${payload.scenario.items.length} preloaded positions. Top ideas: ${topCandidates}`,
        )
        return
      }

      if (command.type === 'add_candidate') {
        const candidate = candidates.find((entry) => entry.ticker.toUpperCase() === command.ticker)
        if (!candidate) {
          pushMessage(
            'assistant',
            `${command.ticker} is not in the current candidate rail. Rebuild draft to refresh candidates.`,
          )
          return
        }
        if (scenarioItems.some((item) => item.candidateId === candidate.id)) {
          pushMessage('assistant', `${command.ticker} is already in the scenario.`)
          return
        }
        addCandidate(candidate)
        pushMessage(
          'assistant',
          `${command.ticker} added at ${candidate.proposedShiftPct.toFixed(1)}% with ${Math.round(candidate.confidence * 100)}% confidence. ${candidate.rationale}`,
        )
        return
      }

      if (command.type === 'remove_candidate') {
        const existing = scenarioItems.find((item) => item.ticker.toUpperCase() === command.ticker)
        if (!existing) {
          pushMessage('assistant', `${command.ticker} is not currently in the scenario.`)
          return
        }
        removeCandidate(existing.candidateId)
        pushMessage('assistant', `${command.ticker} removed from the scenario canvas.`)
        return
      }

      if (command.type === 'set_allocation') {
        const existing = scenarioItems.find((item) => item.ticker.toUpperCase() === command.ticker)
        if (!existing) {
          pushMessage(
            'assistant',
            `${command.ticker} is not currently in the scenario. Add it first, then resize.`,
          )
          return
        }
        setAllocation(existing.candidateId, command.allocationPct)
        pushMessage('assistant', `${command.ticker} allocation set to ${command.allocationPct.toFixed(1)}%.`)
        return
      }

      if (command.type === 'evaluate_scenario') {
        if (scenarioItems.length === 0) {
          pushMessage('assistant', 'Scenario is empty. Add at least one candidate before evaluating.')
          return
        }
        const result = await evaluateScenario()
        if (!result) {
          pushMessage('assistant', 'Evaluation failed. Try again after rebuilding the draft.')
          return
        }
        pushMessage(
          'assistant',
          `Scenario evaluated. Score ${result.score.toFixed(1)}, downside reduction ${Math.round(result.downsideReductionCad)} CAD, turnover ${result.turnoverPct.toFixed(1)}%.`,
        )
        return
      }

      pushMessage(
        'assistant',
        'I did not recognize that command. Type "help" to see supported command formats.',
      )
    } finally {
      setCommandRunning(false)
    }
  }

  const turnoverPct = scenarioItems.reduce((sum, item) => sum + item.allocationPct, 0)
  const turnOverWarning = turnoverPct > riskCapPct

  const baselineOneMonth = temporalAnalysis?.timeBuckets.oneMonth.expectedDollarImpact

  return (
    <div className="strategy-studio">
      <header className="strategy-studio__header">
        <div>
          <h2>Strategy Studio</h2>
          <p>
            Chat-driven scenario design. Drag candidates into canvas, evaluate impact, and keep final trade approval human.
          </p>
        </div>
        <div className="strategy-studio__header-actions">
          <button type="button" onClick={onOpenDrilldown}>
            Back To Drill-down
          </button>
        </div>
      </header>

      <div className="strategy-studio__meta">
        <span>Signal: {draft?.signalHeadline ?? signal?.headline ?? 'Portfolio context'}</span>
        <span>Risk turnover cap: {riskCapPct.toFixed(1)}%</span>
        {typeof baselineOneMonth === 'number' && (
          <span>Baseline 1M: {baselineOneMonth >= 0 ? '+' : '-'}${Math.abs(Math.round(baselineOneMonth)).toLocaleString('en-CA')}</span>
        )}
      </div>

      {turnOverWarning && (
        <p className="strategy-studio__warning">
          Scenario turnover exceeds your current risk-profile cap. Reduce allocations or request explicit override.
        </p>
      )}

      {draftError && <p className="strategy-studio__warning">{draftError}</p>}
      {evaluationError && <p className="strategy-studio__warning">{evaluationError}</p>}
      {!hasDraftForCurrentContext && !draftLoading && (
        <p className="strategy-studio__warning">
          No active draft for this signal yet. Use "Build Draft From Current Context" or run a Prism command.
        </p>
      )}

      <div className="strategy-studio__draft-controls">
        <button type="button" onClick={buildDraftFromSignal} disabled={draftLoading}>
          {draftLoading ? 'Building Draft...' : 'Build Draft From Current Context'}
        </button>
      </div>

      <StrategyStudioLayout
        left={<CandidateRail candidates={candidates} onAddCandidate={addCandidate} />}
        center={
          <ScenarioCanvas
            signal={signal}
            sourceChain={chain}
            temporalAnalysis={temporalAnalysis}
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
          />
        }
        right={
          <div className="strategy-right-stack">
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
          </div>
        }
      />

      {evaluationLoading && <p className="strategy-studio__meta">Evaluating scenario...</p>}
    </div>
  )
}
