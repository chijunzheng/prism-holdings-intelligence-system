import { useCallback, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import type { CausalChainNode, Signal } from '@prism/shared'
import { usePortfolioNetImpact } from '../../hooks/usePortfolioNetImpact'
import { useAppContext } from '../../contexts/AppContext'
import { CausalGraph } from '../../components/graph/CausalGraph'
import { TimeSlider } from '../../components/graph/TimeSlider'
import { SignalContributionsTable } from '../../components/signal/SignalContributionsTable'
import type { GraphTimeHorizon } from '../../types/graph'
import { getHorizonAdjustedImpact } from '../../components/graph/graph-utils'
import { LoadingDots } from '../../components/common/LoadingDots'
import type { SignalsOutletContext } from './SignalsLayout'

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : '+'
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

function formatTimeAgo(isoDate: string): string {
  const ms = Date.now() - Date.parse(isoDate)
  const hours = Math.floor(ms / 3_600_000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function temporalEffectLabel(classification: Signal['temporalClassification']): string {
  if (classification === 'transient') return 'Short-term effect'
  if (classification === 'structural') return 'Long-term shift'
  return 'Uncertain duration'
}

function horizonSignalMultiplier(
  classification: Signal['temporalClassification'],
  horizon: GraphTimeHorizon,
): number {
  if (horizon === 'oneMonth') return 1
  if (horizon === 'oneWeek') {
    if (classification === 'transient') return 1.28
    if (classification === 'structural') return 0.72
    return 0.92
  }
  if (classification === 'structural') return 1.22
  if (classification === 'transient') return 0.7
  return 0.95
}

interface CombinedContributionInsight {
  readonly signalId: string
  readonly headline: string
  readonly summary: string
  readonly source: string
  readonly direction: 'positive' | 'negative' | 'ambiguous'
  readonly oneMonthImpactCad: number
  readonly normalizedWeight: number
  readonly confidenceScore: number
}

interface LiveSignalInsight {
  readonly signal: Signal
  readonly summary: string
  readonly source: string
  readonly oneMonthImpactCad: number | null
}

const HORIZON_LABEL: Readonly<Record<GraphTimeHorizon, string>> = {
  oneWeek: '1W',
  oneMonth: '1M',
  sixMonth: '6M',
}

function confidenceBand(confidenceScore: number): 'high' | 'moderate' | 'caution' {
  if (confidenceScore >= 0.72) return 'high'
  if (confidenceScore >= 0.58) return 'moderate'
  return 'caution'
}

function nodeTypeLabel(type: CausalChainNode['type']): string {
  if (type === 'event') return 'Regime trigger'
  if (type === 'mechanism') return 'Transmission mechanism'
  if (type === 'sector') return 'Sector channel'
  return 'Holding endpoint'
}

function handleCardKeyDown(
  event: KeyboardEvent<HTMLElement>,
  onOpen: () => void,
): void {
  const target = event.target as HTMLElement | null
  if (target?.closest('a,button')) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onOpen()
  }
}

export function CombinedSignalsPane() {
  const { userId, signals } = useOutletContext<SignalsOutletContext>()
  const { data: netImpact, loading, error } = usePortfolioNetImpact(userId)
  const { setAskPrismOpen, setActiveAskPrismEntryContext } = useAppContext()
  const navigate = useNavigate()

  const [selectedNode, setSelectedNode] = useState<CausalChainNode | null>(null)
  const [selectedHorizon, setSelectedHorizon] = useState<GraphTimeHorizon>('oneMonth')

  const handleNodeSelect = useCallback((node: CausalChainNode) => {
    setSelectedNode(node)
  }, [])

  const handleSelectSignal = useCallback((signalId: string) => {
    navigate(`/signals/${encodeURIComponent(signalId)}`)
  }, [navigate])

  const handleDiscussNode = useCallback(() => {
    if (selectedNode) {
      setActiveAskPrismEntryContext({
        entryType: 'graph_node',
        signalId: 'portfolio-net',
        nodeId: selectedNode.id,
        nodeLabel: selectedNode.label,
        autoPrompt: `Explain ${selectedNode.label} within the full regime and how it affects my holdings.`,
      })
    } else {
      setActiveAskPrismEntryContext({
        entryType: 'signals_canvas',
      })
    }
    setAskPrismOpen(true)
  }, [selectedNode, setActiveAskPrismEntryContext, setAskPrismOpen])

  const signalById = useMemo(
    () => new Map(signals.map((signal) => [signal.id, signal])),
    [signals],
  )

  const contributionInsights = useMemo<ReadonlyArray<CombinedContributionInsight>>(
    () =>
      netImpact
        ? netImpact.signalContributions
          .map((item) => {
            const signal = signalById.get(item.signalId)
            const summary = signal?.portfolioSummary ?? signal?.description ?? 'No additional context available.'
            const source = signal?.sources[0]?.publisher ?? signal?.sources[0]?.title ?? 'Source unavailable'
            return {
              signalId: item.signalId,
              headline: item.headline,
              summary,
              source,
              direction: item.direction,
              oneMonthImpactCad: item.oneMonthImpactCad,
              normalizedWeight: item.normalizedWeight,
              confidenceScore: item.confidenceScore,
            }
          })
          .sort((a, b) => Math.abs(b.oneMonthImpactCad) - Math.abs(a.oneMonthImpactCad))
        : [],
    [netImpact, signalById],
  )

  const contributionBySignalId = useMemo(
    () => new Map(contributionInsights.map((item) => [item.signalId, item.oneMonthImpactCad])),
    [contributionInsights],
  )

  const liveSignals = useMemo<ReadonlyArray<LiveSignalInsight>>(
    () =>
      signals
        .map((signal) => ({
          signal,
          summary: signal.portfolioSummary ?? signal.description,
          source: signal.sources[0]?.publisher ?? signal.sources[0]?.title ?? 'Source unavailable',
          oneMonthImpactCad: contributionBySignalId.get(signal.id) ?? null,
        }))
        .sort((a, b) => {
          const aHasImpact = a.oneMonthImpactCad !== null
          const bHasImpact = b.oneMonthImpactCad !== null

          if (aHasImpact && bHasImpact) {
            const impactDelta = Math.abs(b.oneMonthImpactCad ?? 0) - Math.abs(a.oneMonthImpactCad ?? 0)
            if (impactDelta !== 0) return impactDelta
          } else if (aHasImpact !== bHasImpact) {
            return aHasImpact ? -1 : 1
          }

          return Date.parse(b.signal.detectedAt) - Date.parse(a.signal.detectedAt)
        }),
    [contributionBySignalId, signals],
  )

  if (loading) {
    return (
      <div className="signals-main signals-main--combined signals-main--combined-full">
        <LoadingDots className="loading-dots--full-page" />
      </div>
    )
  }

  if (error || !netImpact) {
    return (
      <div className="signals-main signals-main--combined signals-main--combined-full">
        <div className="signals-main__loading" style={{ color: 'var(--color-negative)' }}>
          {error ?? 'No impact data available.'}
        </div>
      </div>
    )
  }

  const netOneMonthImpact = netImpact.temporalAnalysis.timeBuckets.oneMonth.expectedDollarImpact
  const netSelectedImpact = netImpact.temporalAnalysis.timeBuckets[selectedHorizon].expectedDollarImpact
  const horizonRegimeScale = Math.abs(netSelectedImpact) / Math.max(Math.abs(netOneMonthImpact), 1)

  const horizonImpactBySignalId = new Map(
    contributionInsights.map((item) => {
      const classification = signalById.get(item.signalId)?.temporalClassification ?? 'ambiguous'
      const multiplier = horizonSignalMultiplier(classification, selectedHorizon)
      return [item.signalId, item.oneMonthImpactCad * horizonRegimeScale * multiplier]
    }),
  )

  const nodeById = new Map(netImpact.chain.nodes.map((node) => [node.id, node]))
  const incomingEdges = selectedNode
    ? netImpact.chain.edges.filter((edge) => edge.target === selectedNode.id)
    : []
  const outgoingEdges = selectedNode
    ? netImpact.chain.edges.filter((edge) => edge.source === selectedNode.id)
    : []
  const selectedOneMonthImpact = selectedNode
    ? getHorizonAdjustedImpact(selectedNode, netImpact.temporalAnalysis, 'oneMonth', false)
    : 0
  const selectedHorizonImpact = selectedNode
    ? getHorizonAdjustedImpact(selectedNode, netImpact.temporalAnalysis, selectedHorizon, false)
    : 0
  const lookThrough = Array.isArray(selectedNode?.metadata?.lookThroughConstituents)
    ? (selectedNode?.metadata?.lookThroughConstituents as ReadonlyArray<string>)
    : []

  return (
    <div className="signals-main signals-main--combined signals-main--combined-full">
        <div className="signals-main__content">
          <section className="signals-section">
            <div className="signals-section__header">
              <h2 className="signals-section__title">Live signals</h2>
              <p className="signals-section__subtitle">
                Active signals ranked by portfolio impact in the current regime.
              </p>
            </div>

            {liveSignals.length === 0 ? (
              <div className="signals-panel">
                <p className="signals-live-empty">No active signals right now.</p>
              </div>
            ) : (
              <div className="signals-live-grid">
                {liveSignals.map((item) => {
                  const { signal, oneMonthImpactCad } = item
                  const impactText = oneMonthImpactCad === null
                    ? 'Combined 1M contribution pending model update'
                    : `Combined 1M contribution: ${formatDollar(oneMonthImpactCad)}`
                  const impactClass = oneMonthImpactCad === null
                    ? 'signals-live-card__impact--neutral'
                    : oneMonthImpactCad < 0
                      ? 'signals-live-card__impact--negative'
                      : 'signals-live-card__impact--positive'

                  return (
                    <article
                      key={signal.id}
                      className="signals-live-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectSignal(signal.id)}
                      onKeyDown={(event) => handleCardKeyDown(event, () => handleSelectSignal(signal.id))}
                    >
                      <div className="signals-live-card__body">
                        <div className="signals-live-card__meta">
                          <span className="signals-live-card__source">{item.source}</span>
                          <span className="signals-live-card__time">{formatTimeAgo(signal.detectedAt)}</span>
                        </div>

                        <h3 className="signals-live-card__headline">{signal.headline}</h3>
                        <p className="signals-live-card__summary">{item.summary}</p>
                        <p className={`signals-live-card__impact ${impactClass}`}>{impactText}</p>
                        <p className="signals-live-card__temporal">{temporalEffectLabel(signal.temporalClassification)}</p>
                      </div>

                      <div className="signals-live-card__footer">
                        {signal.sources[0]?.url ? (
                          <a
                            className="signals-live-card__publisher-link"
                            href={signal.sources[0].url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {item.source}
                          </a>
                        ) : (
                          <span className="signals-live-card__publisher">{item.source}</span>
                        )}
                        <span className="signals-live-card__cta">View analysis &rarr;</span>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section className="signals-section">
            <div className="signals-section__header">
              <h2 className="signals-section__title">Combined causal map · {HORIZON_LABEL[selectedHorizon]}</h2>
              <p className="signals-section__subtitle">
                Transmission map reweighted by selected horizon.
              </p>
            </div>

            <div className="signals-panel">
              <div className="signals-main__graph">
                <CausalGraph
                  chain={netImpact.chain}
                  temporalAnalysis={netImpact.temporalAnalysis}
                  horizon={selectedHorizon}
                  counterfactualEnabled={false}
                  expandedDepth
                  selectedNodeId={selectedNode?.id ?? null}
                  onNodeSelect={handleNodeSelect}
                  mode="canvas"
                />
              </div>
              <div className="signals-main__graph-controls">
                <TimeSlider
                  value={selectedHorizon}
                  onChange={setSelectedHorizon}
                />
              </div>
            </div>
          </section>

          {selectedNode && (
            <section className="signals-panel">
              <div className="combined-node-detail">
                <div className="combined-node-detail__header">
                  <div>
                    <h3 className="combined-node-detail__title">{selectedNode.label}</h3>
                    <p className="combined-node-detail__meta">
                      {nodeTypeLabel(selectedNode.type)} · {(selectedNode.confidence * 100).toFixed(0)}% confidence
                    </p>
                  </div>
                  <div className="combined-node-detail__impact-stack">
                    <span
                      className={
                        selectedHorizonImpact < 0
                          ? 'combined-node-detail__impact-value combined-node-detail__impact-value--negative'
                          : 'combined-node-detail__impact-value combined-node-detail__impact-value--positive'
                      }
                    >
                      {formatDollar(selectedHorizonImpact)}
                    </span>
                    <span className="combined-node-detail__impact-label">{HORIZON_LABEL[selectedHorizon]} modeled impact</span>
                  </div>
                </div>

                <p className="combined-node-detail__description">{selectedNode.description}</p>

                <div className="combined-node-detail__grid">
                  <div className="combined-node-detail__block">
                    <p className="combined-node-detail__block-title">Incoming drivers</p>
                    {incomingEdges.length === 0 ? (
                      <p className="combined-node-detail__empty">No upstream drivers for this node.</p>
                    ) : (
                      <ul className="combined-node-detail__list">
                        {incomingEdges.slice(0, 3).map((edge) => (
                          <li key={edge.id}>
                            <strong>{nodeById.get(edge.source)?.label ?? edge.source}</strong>
                            <span> · {edge.mechanism}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="combined-node-detail__block">
                    <p className="combined-node-detail__block-title">Downstream effects</p>
                    {outgoingEdges.length === 0 ? (
                      <p className="combined-node-detail__empty">No downstream propagation from this node.</p>
                    ) : (
                      <ul className="combined-node-detail__list">
                        {outgoingEdges.slice(0, 3).map((edge) => (
                          <li key={edge.id}>
                            <strong>{nodeById.get(edge.target)?.label ?? edge.target}</strong>
                            <span> · {edge.mechanism}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="combined-node-detail__block">
                    <p className="combined-node-detail__block-title">Quant snapshot</p>
                    <dl className="combined-node-detail__metrics">
                      <div>
                        <dt>1M baseline</dt>
                        <dd>{formatDollar(selectedOneMonthImpact)}</dd>
                      </div>
                      <div>
                        <dt>{HORIZON_LABEL[selectedHorizon]} adjusted</dt>
                        <dd>{formatDollar(selectedHorizonImpact)}</dd>
                      </div>
                      <div>
                        <dt>Path fan-out</dt>
                        <dd>{outgoingEdges.length}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {lookThrough.length > 0 && (
                  <div className="combined-node-detail__lookthrough">
                    <p className="combined-node-detail__block-title">Look-through constituents</p>
                    <p className="combined-node-detail__lookthrough-list">
                      {lookThrough.slice(0, 6).join(' · ')}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  className="combined-node-detail__discuss"
                  onClick={handleDiscussNode}
                >
                  Discuss with Prism &rarr;
                </button>
              </div>
            </section>
          )}

          <section className="signals-section">
            <div className="signals-section__header">
              <h2 className="signals-section__title">Signal contributions</h2>
              <p className="signals-section__subtitle">
                Attribution table explaining why the combined causal map is weighted this way.
              </p>
            </div>

            <div className="signals-panel">
              <SignalContributionsTable
                contributions={netImpact.signalContributions}
                onSelectSignal={handleSelectSignal}
                showHeader={false}
                impactColumnLabel={`${HORIZON_LABEL[selectedHorizon]} Impact`}
                impactBySignalId={horizonImpactBySignalId}
                detailsBySignalId={new Map(contributionInsights.map((item) => [
                  item.signalId,
                  {
                    summary: item.summary,
                    source: item.source,
                    confidenceBand: confidenceBand(item.confidenceScore),
                  },
                ]))}
              />
            </div>
          </section>
        </div>
      </div>
  )
}
