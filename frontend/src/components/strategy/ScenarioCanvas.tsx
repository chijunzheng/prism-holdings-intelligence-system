import { useMemo, useState } from 'react'
import type { CausalChain, CausalChainNode, Signal } from '@prism/shared'
import type { StrategyScenarioItem, TemporalAnalysis } from '../../types/graph'
import { CausalGraph } from '../graph/CausalGraph'
import { buildMitigationReasoningChain } from './reasoning-graph'

interface ScenarioCanvasProps {
  readonly signal: Signal | null
  readonly sourceChain: CausalChain | null
  readonly temporalAnalysis: TemporalAnalysis | null
  readonly items: ReadonlyArray<StrategyScenarioItem>
  readonly onDropCandidateId: (candidateId: string) => void
  readonly onRemove: (candidateId: string) => void
  readonly onAllocationChange: (candidateId: string, nextAllocation: number) => void
  readonly onEvaluate: () => void
  readonly onReasoningNodeSelect?: (node: CausalChainNode | null) => void
}

function fallbackTemporal(items: ReadonlyArray<StrategyScenarioItem>): TemporalAnalysis {
  const mitigation = items.reduce((sum, item) => sum + item.expectedMitigationCad * item.allocationPct, 0)
  const oneWeek = -Math.max(40, Math.round(mitigation * 0.18))
  const oneMonth = -Math.max(100, Math.round(mitigation * 0.32))
  const sixMonth = -Math.max(60, Math.round(mitigation * 0.2))

  return {
    classification: 'ambiguous',
    confidence: 0.55,
    timeBuckets: {
      oneWeek: {
        direction: 'negative',
        expectedDollarImpact: oneWeek,
        lowDollarImpact: oneWeek * 1.4,
        highDollarImpact: oneWeek * 0.5,
        confidence: 0.48,
      },
      oneMonth: {
        direction: 'negative',
        expectedDollarImpact: oneMonth,
        lowDollarImpact: oneMonth * 1.5,
        highDollarImpact: oneMonth * 0.55,
        confidence: 0.52,
      },
      sixMonth: {
        direction: 'ambiguous',
        expectedDollarImpact: sixMonth,
        lowDollarImpact: sixMonth * 1.7,
        highDollarImpact: Math.abs(sixMonth) * 0.45,
        confidence: 0.46,
      },
    },
    recommendations: [],
  }
}

export function ScenarioCanvas({
  signal,
  sourceChain,
  temporalAnalysis,
  items,
  onDropCandidateId,
  onRemove,
  onAllocationChange,
  onEvaluate,
  onReasoningNodeSelect,
}: ScenarioCanvasProps) {
  const [selectedNode, setSelectedNode] = useState<CausalChainNode | null>(null)

  const reasoningChain = useMemo(
    () =>
      buildMitigationReasoningChain({
        signal,
        sourceChain,
        scenarioItems: items,
        temporalAnalysis,
      }),
    [items, signal, sourceChain, temporalAnalysis],
  )

  const graphTemporal = temporalAnalysis ?? fallbackTemporal(items)

  return (
    <section
      className="strategy-canvas strategy-canvas--graph"
      aria-label="Strategy reasoning canvas"
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(event) => {
        event.preventDefault()
        const candidateId = event.dataTransfer.getData('application/prism-strategy-candidate')
        if (candidateId) onDropCandidateId(candidateId)
      }}
    >
      <header className="strategy-canvas__header">
        <div>
          <h3>Mitigation Reasoning Graph</h3>
          <p>Signal -&gt; Impact channels -&gt; Mitigation thesis -&gt; Candidate positions.</p>
        </div>
        <button type="button" className="strategy-canvas__evaluate-btn" onClick={onEvaluate}>
          Evaluate Scenario
        </button>
      </header>

      {items.length === 0 && (
        <p className="strategy-canvas__empty">
          Build a draft first, then drag candidates here to generate mitigation reasoning paths.
        </p>
      )}

      {items.length > 0 && (
        <div className="strategy-canvas__graph-shell">
          <div className="strategy-canvas__graph">
            <CausalGraph
              chain={reasoningChain}
              temporalAnalysis={graphTemporal}
              horizon="oneMonth"
              counterfactualEnabled={false}
              expandedDepth={true}
              clusterAssets={false}
              selectedNodeId={selectedNode?.id ?? null}
              onNodeSelect={(node) => {
                setSelectedNode(node)
                onReasoningNodeSelect?.(node)
              }}
            />
          </div>
          <aside className="strategy-canvas__node-insight">
            <h4>Path Insight</h4>
            {!selectedNode && <p>Select a node in the graph to inspect the reasoning details.</p>}
            {selectedNode && (
              <>
                <p className="strategy-canvas__node-label">{selectedNode.label}</p>
                <p className="strategy-canvas__node-type">{selectedNode.type}</p>
                <p className="strategy-canvas__node-desc">{selectedNode.description}</p>
                <p className="strategy-canvas__node-meta">
                  Confidence {(selectedNode.confidence * 100).toFixed(0)}%
                </p>
              </>
            )}
          </aside>
        </div>
      )}

      {items.length > 0 && (
        <ul className="strategy-canvas__positions">
          {items.map((item) => (
            <li key={item.candidateId} className="strategy-canvas__position-item">
              <div className="strategy-canvas__item-head">
                <div>
                  <p className="strategy-canvas__ticker">{item.ticker}</p>
                  <p className="strategy-canvas__name">{item.name}</p>
                </div>
                <button
                  type="button"
                  className="strategy-canvas__remove-btn"
                  onClick={() => onRemove(item.candidateId)}
                >
                  Remove
                </button>
              </div>

              <label className="strategy-canvas__allocation-label" htmlFor={`alloc-${item.candidateId}`}>
                Allocation shift: {item.allocationPct.toFixed(1)}%
              </label>
              <input
                id={`alloc-${item.candidateId}`}
                className="strategy-canvas__allocation-input"
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={item.allocationPct}
                onChange={(event) => onAllocationChange(item.candidateId, Number(event.target.value))}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
