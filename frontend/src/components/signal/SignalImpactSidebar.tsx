import { useCallback, useState } from 'react'
import type { CausalChain } from '@prism/shared'
import type { GraphTimeHorizon, TemporalAnalysis } from '../../types/graph'
import { useAppContext } from '../../contexts/AppContext'

interface SignalImpactSidebarProps {
  readonly chain: CausalChain
  readonly temporalAnalysis: TemporalAnalysis
  readonly signalId: string
}

function formatDollar(amount: number): string {
  const abs = Math.abs(amount)
  const prefix = amount < 0 ? '-' : '+'
  if (abs >= 1000) return `${prefix}$${(abs / 1000).toFixed(1)}k`
  return `${prefix}$${abs.toFixed(0)}`
}

const HORIZON_LABELS: Record<GraphTimeHorizon, string> = {
  oneWeek: '1W',
  oneMonth: '1M',
  sixMonth: '6M',
}

const HORIZONS: ReadonlyArray<GraphTimeHorizon> = ['oneWeek', 'oneMonth', 'sixMonth']

export function SignalImpactSidebar({ chain, temporalAnalysis, signalId }: SignalImpactSidebarProps) {
  const [horizon, setHorizon] = useState<GraphTimeHorizon>('oneMonth')
  const { setAskPrismOpen, setActiveAskPrismEntryContext } = useAppContext()

  const bucket = temporalAnalysis.timeBuckets[horizon]
  const netImpact = bucket.expectedDollarImpact

  const assetNodes = chain.nodes.filter((n) => n.type === 'asset')

  const handleDiscuss = useCallback(() => {
    setActiveAskPrismEntryContext({
      entryType: 'sidebar_cta',
      signalId,
      autoPrompt: 'Discuss this signal impact in detail and what I should watch next.',
    })
    setAskPrismOpen(true)
  }, [setActiveAskPrismEntryContext, setAskPrismOpen, signalId])

  return (
    <aside className="signal-sidebar">
      {/* Net Impact Card */}
      <div className="signal-sidebar__card">
        <p className="signal-sidebar__card-title">Estimated Impact</p>
        <p className={`signal-sidebar__net-impact ${netImpact < 0 ? 'signal-sidebar__net-impact--negative' : 'signal-sidebar__net-impact--positive'}`}>
          {formatDollar(netImpact)}
        </p>

        <div className="signal-sidebar__horizon-toggle">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              className={`signal-sidebar__horizon-btn ${horizon === h ? 'signal-sidebar__horizon-btn--active' : ''}`}
              onClick={() => setHorizon(h)}
            >
              {HORIZON_LABELS[h]}
            </button>
          ))}
        </div>

        {assetNodes.length > 0 && (
          <div className="signal-sidebar__breakdown">
            {assetNodes
              .sort((a, b) => Math.abs(b.dollarImpact ?? 0) - Math.abs(a.dollarImpact ?? 0))
              .slice(0, 5)
              .map((node) => (
                <div key={node.id} className="signal-sidebar__breakdown-row">
                  <span className="signal-sidebar__breakdown-ticker">{node.label}</span>
                  <span className={`signal-sidebar__breakdown-impact ${(node.dollarImpact ?? 0) < 0 ? 'affected-holdings__impact--negative' : 'affected-holdings__impact--positive'}`}>
                    {formatDollar(node.dollarImpact ?? 0)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Counterfactual */}
      {temporalAnalysis.counterfactual && (
        <div className="signal-sidebar__card">
          <p className="signal-sidebar__card-title">What if this reverses?</p>
          <div className="signal-sidebar__counterfactual">
            <p className="signal-sidebar__counterfactual-label">
              {temporalAnalysis.counterfactual.scenario}
            </p>
            <p>{temporalAnalysis.counterfactual.explanation}</p>
            <p style={{ marginTop: '0.35rem', fontWeight: 600 }}>
              Difference: {formatDollar(temporalAnalysis.counterfactual.estimatedOutcomeDifferenceCad)}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <a className="signal-sidebar__cta" href={`/signals/${signalId}/plan`}>
        Build a plan to reduce this risk &rarr;
      </a>

      <button type="button" className="signal-sidebar__discuss" onClick={handleDiscuss}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Discuss with Prism &rarr;
      </button>
    </aside>
  )
}
